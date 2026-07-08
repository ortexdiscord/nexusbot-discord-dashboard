/**
 * Shared in-memory store for Disco Hook button ephemeral responses.
 * Keys:   Discord button customId (e.g. "disco_btn_<nanoid>")
 * Values: The ephemeral message text shown when a user clicks the button.
 *
 * Populated by the webhook-sender send route; read by the bot's
 * InteractionCreate → button handler.
 */
export const discoButtonResponses = new Map<string, string>();
