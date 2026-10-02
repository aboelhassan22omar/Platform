import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Role } from '../generated/prisma/enums';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { VideosService } from './videos.service';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Post(':lessonId/playback')
  @ApiOperation({ summary: 'طلب إذن مشاهدة قصير الأجل' })
  issueTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Req() req: Request,
  ) {
    return this.videos.issuePlaybackTicket(user.id, lessonId, {
      isStaff: user.role !== Role.STUDENT,
      ip: req.ip,
    });
  }

  /**
   * Manifest and segments.
   *
   * Public at the guard level because hls.js cannot attach the auth cookie to
   * segment requests in every mobile browser — authorisation comes from the
   * ticket instead, which is verified on every single request here.
   */
  @Public()
  @Get(':lessonId/manifest.m3u8')
  @ApiExcludeEndpoint()
  async manifest(
    @Param('lessonId') lessonId: string,
    @Query('ticket') ticket: string,
    @Res() res: Response,
  ) {
    if (!ticket) throw new ForbiddenException('رابط المشاهدة غير صالح');
    await this.videos.resolveTicket(lessonId, ticket);

    const { stream, contentType } = await this.videos.streamObject(
      lessonId,
      'master.m3u8',
    );

    // Rewrite the playlist so every child URL carries the same ticket.
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const body = this.rewritePlaylist(
      Buffer.concat(chunks).toString('utf8'),
      ticket,
      `/api/videos/${encodeURIComponent(lessonId)}/hls/`,
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(body);
  }

  @Public()
  @Get(':lessonId/hls/*path')
  @ApiExcludeEndpoint()
  async segment(
    @Param('lessonId') lessonId: string,
    @Param('path') path: string | string[],
    @Query('ticket') ticket: string,
    @Res() res: Response,
  ) {
    if (!ticket) throw new ForbiddenException('رابط المشاهدة غير صالح');
    await this.videos.resolveTicket(lessonId, ticket);

    const relative = Array.isArray(path) ? path.join('/') : path;
    const { stream, contentType } = await this.videos.streamObject(lessonId, relative);

    res.setHeader('Content-Type', contentType);
    if (relative.endsWith('.m3u8')) {
      // Variant playlists contain relative segment URLs. They need the same
      // ticket as the master playlist or every segment request is rejected.
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const body = this.rewritePlaylist(Buffer.concat(chunks).toString('utf8'), ticket);
      res.setHeader('Cache-Control', 'no-store, private');
      res.send(body);
      return;
    }

    // Segments are immutable but access-controlled: cache in the browser only.
    res.setHeader('Cache-Control', 'private, max-age=300');
    stream.pipe(res);
  }

  private rewritePlaylist(body: string, ticket: string, uriPrefix = ''): string {
    const encodedTicket = encodeURIComponent(ticket);
    return body
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const uri = `${uriPrefix}${trimmed}`;
        return `${uri}${uri.includes('?') ? '&' : '?'}ticket=${encodedTicket}`;
      })
      .join('\n');
  }
}
