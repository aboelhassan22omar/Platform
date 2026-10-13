// Shared by OrdersService and ManualTransfersController. Kept in its own file:
// importing it from the controller created a circular import that left
// OrdersService undefined when the app booted.

/** What a student sent as proof, stored on the pending Payment row. */
export interface TransferSubmission {
  senderPhone: string;
  transactionReference?: string;
  receiptKey: string;
  submittedAt: string;
  /** Set when an admin sends the proof back; cleared by the next submission. */
  review?: { status: 'rejected'; reason: string; at: string; by: string };
}

/**
 * Where a student's proof stands. Proofs sent before screenshots existed
 * carry only the sender number and transaction id; they still need review.
 */
export const transferState = (
  submission: Partial<TransferSubmission> | null | undefined,
): 'waiting' | 'submitted' | 'rejected' => {
  if (submission?.review?.status === 'rejected') return 'rejected';
  return submission?.receiptKey || submission?.senderPhone ? 'submitted' : 'waiting';
};
