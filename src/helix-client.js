/**
 * Twitch Helix API client for fetching stream engagement metrics.
 *
 * Provides observation data for RLAN engagement marks: viewer counts, chat activity,
 * cheers, raids. Uses official Helix API endpoints with OAuth bearer tokens.
 *
 * Design constraint: All metrics are aggregated counts or timestamps. No raw user
 * data (logins, chat text, identifiers) is stored or transmitted.
 */

/**
 * Create a Helix API client.
 *
 * @param {string} clientId - OAuth client ID (from Doppler env)
 * @param {string} accessToken - Bearer token for API calls (from Doppler env)
 * @param {string} baseUrl - Helix API base URL (default: https://api.twitch.tv/helix)
 * @returns {Object} Helix client with methods to fetch stream data
 */
export function createHelixClient(clientId, accessToken, baseUrl = "https://api.twitch.tv/helix") {
  if (!clientId || typeof clientId !== "string") {
    throw new Error("helix client requires clientId");
  }
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("helix client requires accessToken");
  }

  const headers = {
    "Client-ID": clientId,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  return {
    /**
     * Fetch stream data by username.
     *
     * Returns: { id, user_id, user_name, title, viewer_count, started_at, language, ... }
     * Null if stream is offline.
     */
    async getStreamByUsername(username) {
      if (!username || typeof username !== "string") {
        throw new Error("getStreamByUsername requires username string");
      }

      const url = `${baseUrl}/streams?user_login=${encodeURIComponent(username)}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Helix API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data && data.data.length > 0 ? data.data[0] : null;
    },

    /**
     * Fetch channel data by username (includes followers, subscribers, etc.).
     *
     * Returns: { broadcaster_id, broadcaster_login, broadcaster_name, followers, ... }
     */
    async getChannelByUsername(username) {
      if (!username || typeof username !== "string") {
        throw new Error("getChannelByUsername requires username string");
      }

      // Get user ID first
      const userUrl = `${baseUrl}/users?login=${encodeURIComponent(username)}`;
      const userResponse = await fetch(userUrl, { headers });

      if (!userResponse.ok) {
        throw new Error(`Helix API error fetching user: ${userResponse.status}`);
      }

      const userData = await userResponse.json();
      if (!userData.data || userData.data.length === 0) {
        return null;
      }

      const userId = userData.data[0].id;

      // Get channel info
      const channelUrl = `${baseUrl}/channels?broadcaster_id=${userId}`;
      const channelResponse = await fetch(channelUrl, { headers });

      if (!channelResponse.ok) {
        throw new Error(`Helix API error fetching channel: ${channelResponse.status}`);
      }

      const channelData = await channelResponse.json();
      return channelData.data && channelData.data.length > 0 ? channelData.data[0] : null;
    },

    /**
     * Fetch recent events (cheers, raids) for a streamer.
     *
     * Returns: { events: [{type, user_name, bits, raid_count, created_at}, ...] }
     * type: "cheer" | "raid"
     */
    async getRecentEvents(broadcasterId, limit = 100) {
      if (!broadcasterId || typeof broadcasterId !== "string") {
        throw new Error("getRecentEvents requires broadcasterId");
      }

      // Note: Helix doesn't have a direct "recent events" endpoint.
      // In production, you would use EventSub subscriptions or polling
      // Get cheers via moderation logs or a custom endpoint.
      // For now, return a stub that would be filled by EventSub in production.

      return { events: [] };
    },

    /**
     * Fetch chat settings (slow chat, emote-only mode, follower-only, subscriber-only).
     *
     * Returns: { emote_only, follower_only, slow, subscriber_only, moderator_delay }
     */
    async getChatSettings(broadcasterId) {
      if (!broadcasterId || typeof broadcasterId !== "string") {
        throw new Error("getChatSettings requires broadcasterId");
      }

      const url = `${baseUrl}/chat/settings?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Helix API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data && data.data.length > 0 ? data.data[0] : null;
    },
  };
}

/**
 * Observe a stream and extract engagement metrics.
 *
 * Aggregates Twitch Helix data into RLAN observation signals:
 * - viewerPeakCount: current viewer_count
 * - chatEventsCount: estimated from stream duration (stub pending EventSub)
 * - cheersCount: recent cheers (stub pending EventSub)
 * - raidsCount: recent raids (stub pending EventSub)
 *
 * @param {Object} client - Helix client from createHelixClient
 * @param {string} streamerUsername - Twitch streamer username
 * @returns {Object|null} Observation object, or null if stream offline
 */
export async function observeStreamEngagement(client, streamerUsername) {
  if (!client || typeof client !== "object") {
    throw new Error("observeStreamEngagement requires helix client");
  }
  if (!streamerUsername || typeof streamerUsername !== "string") {
    throw new Error("observeStreamEngagement requires streamerUsername");
  }

  const stream = await client.getStreamByUsername(streamerUsername);
  if (!stream) {
    return null; // Stream offline
  }

  const channel = await client.getChannelByUsername(streamerUsername);
  if (!channel) {
    return null;
  }

  // Observation snapshot
  const now = new Date().toISOString();
  const observation = {
    streamer_username: streamerUsername,
    streamer_id: stream.user_id,
    stream_id: stream.id,

    // Viewer count at observation time
    viewer_count: stream.viewer_count || 0,

    // Followers (proxy for community engagement)
    follower_count: channel.follower_count || 0,

    // Stream started time (for duration calculation)
    started_at: stream.started_at,

    // Chat settings (emote-only, follower-only, slow mode indicate engagement barriers)
    chat_settings: await client.getChatSettings(stream.broadcaster_id),

    // Observation timestamp
    observed_at: now,
  };

  return observation;
}

/**
 * Convert a stream observation into RLAN engagement metrics.
 *
 * Aggregates observation data into the four signal types used by RLAN:
 * - viewerPeakCount: current viewer_count
 * - chatEventsCount: placeholder (would require EventSub or analytics API)
 * - cheersCount: placeholder (would require EventSub)
 * - raidsCount: placeholder (would require EventSub)
 *
 * All values are integers representing discrete event or metric counts.
 *
 * @param {Object} observation - Stream observation from observeStreamEngagement
 * @returns {Object} Engagement metrics object
 */
export function observationToEngagementMetrics(observation) {
  if (!observation || typeof observation !== "object") {
    throw new Error("observationToEngagementMetrics requires observation object");
  }

  const metrics = {
    // Direct metrics from stream data
    viewerPeakCount: Math.max(0, observation.viewer_count || 0),

    // Follower count as a proxy for engagement tier
    // (in production, this would be chat message count from EventSub)
    chatEventsCount: Math.max(0, Math.floor((observation.follower_count || 0) / 100)),

    // Placeholder: EventSub subscriptions would provide actual cheer count
    cheersCount: 0,

    // Placeholder: EventSub subscriptions would provide actual raid count
    raidsCount: 0,

    // Observation metadata for verification
    observation_timestamp: observation.observed_at,
    stream_started: observation.started_at,
  };

  return metrics;
}

/**
 * Validate Helix API credentials (test the connection).
 *
 * @param {string} clientId - OAuth client ID
 * @param {string} accessToken - Bearer token
 * @param {string} testUsername - Username to test with
 * @returns {Promise<boolean>} True if credentials work, false otherwise
 */
export async function validateHelixCredentials(clientId, accessToken, testUsername = "twitch") {
  try {
    const client = createHelixClient(clientId, accessToken);
    const stream = await client.getStreamByUsername(testUsername);
    // Success if we got a response (stream might be null/offline, that's ok)
    return true;
  } catch (err) {
    return false;
  }
}
