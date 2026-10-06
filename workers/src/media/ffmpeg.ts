import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Rendition } from '../config';

interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
}

function run(command: string, args: string[], onStderr?: (chunk: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      const text = data.toString();
      // ffmpeg is verbose; keep only the tail for the error message.
      stderr = (stderr + text).slice(-4000);
      onStderr?.(text);
    });

    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} exited with ${code}: ${stderr.slice(-800)}`)),
    );
  });
}

export async function probe(filePath: string): Promise<ProbeResult> {
  const output = await run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    filePath,
  ]);

  const parsed = JSON.parse(output) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };

  const stream = parsed.streams?.[0];
  if (!stream?.width || !stream.height) {
    throw new Error('الملف المرفوع مش فيه مسار فيديو صالح');
  }

  return {
    durationSeconds: Math.round(Number(parsed.format?.duration ?? 0)),
    width: stream.width,
    height: stream.height,
  };
}

/**
 * Builds the HLS ladder in a single ffmpeg invocation.
 *
 * One pass with multiple outputs decodes the source once instead of once per
 * rendition — roughly a 3x saving on a three-rung ladder.
 */
export async function transcodeToHls(
  sourcePath: string,
  outputDir: string,
  source: ProbeResult,
  onProgress: (percent: number) => void,
  options: { renditions: Rendition[]; segmentSeconds: number },
): Promise<Rendition[]> {
  // Never upscale: a 480p source gets 360p and 480p, not a fake 720p.
  const applicable = options.renditions.filter((r) => r.height <= source.height);
  const ladder = applicable.length ? applicable : [options.renditions[0]];

  const args: string[] = ['-hide_banner', '-y', '-i', sourcePath];

  // Map the same input into each rendition.
  for (let i = 0; i < ladder.length; i += 1) {
    args.push('-map', '0:v:0', '-map', '0:a:0?');
  }

  ladder.forEach((rendition, index) => {
    args.push(
      `-filter:v:${index}`,
      `scale=-2:${rendition.height}`,
      `-c:v:${index}`,
      'libx264',
      `-b:v:${index}`,
      `${rendition.videoKbps}k`,
      `-maxrate:v:${index}`,
      `${Math.round(rendition.videoKbps * 1.1)}k`,
      `-bufsize:v:${index}`,
      `${rendition.videoKbps * 2}k`,
      `-preset:v:${index}`,
      'veryfast',
      `-profile:v:${index}`,
      'main',
      `-c:a:${index}`,
      'aac',
      `-b:a:${index}`,
      `${rendition.audioKbps}k`,
      `-ac:a:${index}`,
      '2',
    );
  });

  args.push(
    // Keyframe every segment so players can switch rendition cleanly.
    '-g',
    String(options.segmentSeconds * 25),
    '-keyint_min',
    String(options.segmentSeconds * 25),
    '-sc_threshold',
    '0',
    '-f',
    'hls',
    '-hls_time',
    String(options.segmentSeconds),
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    path.join(outputDir, 'v%v', 'seg_%03d.ts'),
    '-master_pl_name',
    'master.m3u8',
    '-var_stream_map',
    ladder.map((_, index) => `v:${index},a:${index}`).join(' '),
    path.join(outputDir, 'v%v', 'playlist.m3u8'),
    '-progress',
    'pipe:2',
  );

  const totalMicros = source.durationSeconds * 1_000_000;
  let lastReported = 0;

  await run('ffmpeg', args, (chunk) => {
    // ffmpeg's -progress output reports out_time_us on each tick.
    const match = /out_time_us=(\d+)/.exec(chunk);
    if (!match || !totalMicros) return;

    const percent = Math.min(99, Math.round((Number(match[1]) / totalMicros) * 100));
    // Throttle DB writes: report only on a meaningful change.
    if (percent >= lastReported + 5) {
      lastReported = percent;
      onProgress(percent);
    }
  });

  return ladder;
}

export async function extractPoster(
  sourcePath: string,
  outputPath: string,
  durationSeconds?: number,
): Promise<void> {
  const seekSeconds =
    durationSeconds === undefined ? 3 : Math.min(3, Math.max(0, durationSeconds / 2));
  await run('ffmpeg', [
    '-hide_banner',
    '-y',
    // Skip lead-in without seeking past the end of a short clip.
    '-ss',
    String(seekSeconds),
    '-i',
    sourcePath,
    '-frames:v',
    '1',
    '-vf',
    'scale=1280:-2',
    '-q:v',
    '3',
    outputPath,
  ]);
}
