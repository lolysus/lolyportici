import "server-only";

type CalendarEventInput = {
  summary: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error_description?: string;
};

export class GoogleCalendarAdapter {
  isConfigured() {
    return Boolean(
      process.env.GOOGLE_CALENDAR_CLIENT_ID &&
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
        process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    );
  }

  async createEvent(event: CalendarEventInput) {
    if (!this.isConfigured()) return { status: "sandbox" as const };

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const token = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(token.error_description ?? "Google OAuth token refresh failed.");
    }

    const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary");
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: {
            dateTime: event.startAt,
            timeZone: event.timezone ?? process.env.APP_TIMEZONE ?? "Europe/Rome",
          },
          end: {
            dateTime: event.endAt,
            timeZone: event.timezone ?? process.env.APP_TIMEZONE ?? "Europe/Rome",
          },
        }),
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as { id?: string; htmlLink?: string; error?: { message?: string } };
    if (!response.ok || !payload.id) {
      throw new Error(payload.error?.message ?? "Google Calendar event creation failed.");
    }
    return { status: "sent" as const, externalId: payload.id, url: payload.htmlLink };
  }
}
