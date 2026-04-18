import type { BrandwikiConfig } from './config.js';

function isDiscordWebhook(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('discord.com') || parsed.hostname.includes('discordapp.com');
  } catch {
    return false;
  }
}

export async function sendNotification(
  config: BrandwikiConfig,
  event: string,
  message: string
): Promise<void> {
  const webhookUrl = config.notifications?.webhookUrl;
  if (!webhookUrl) return;

  const allowedEvents = config.notifications?.events;
  if (allowedEvents && !allowedEvents.includes(event as 'compile' | 'fetch' | 'lint')) return;

  const body = isDiscordWebhook(webhookUrl)
    ? JSON.stringify({ content: message })
    : JSON.stringify({ text: message });

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    // Silently ignore notification failures
  }
}
