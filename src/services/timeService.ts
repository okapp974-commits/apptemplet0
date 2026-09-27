import { format } from 'date-fns';

export interface TimeSyncResult {
  isSync: boolean;
  deviceDate: Date;
  serverDate: Date | null;
  diffMinutes: number;
  reason?: string;
  formattedServerDate?: string;
  formattedDeviceDate?: string;
}

const MAX_ALLOWED_DRIFT_MS = 5 * 60 * 1000; // 5 minutes tolerance threshold
const LAST_KNOWN_SERVER_TIME_KEY = 'last_known_server_timestamp';
const TIME_ANCHOR_KEY = 'ok_app_time_anchor';

interface TimeAnchor {
  serverMs: number;
  deviceMs: number;
  perfMs: number;
  updatedAtIso: string;
}

/**
 * Fetch true server/internet time from multiple reliable sources
 */
export async function fetchServerTime(): Promise<Date | null> {
  // Strategy 1: Supabase REST API (Direct server Date header)
  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${supabaseUrl}/rest/v1/customers?select=id&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Cache-Control': 'no-cache, no-store'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const dateStr = res.headers.get('date');
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    } catch (e) {
      console.warn('Supabase date header fetch failed:', e);
    }
  }

  // Strategy 2: WorldTimeAPI (Cairo timezone)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://worldtimeapi.org/api/timezone/Africa/Cairo', {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.datetime) {
        const serverDate = new Date(data.datetime);
        if (!isNaN(serverDate.getTime())) {
          return serverDate;
        }
      }
    }
  } catch (e) {
    console.warn('WorldTimeAPI failed:', e);
  }

  // Strategy 3: TimeAPI.io
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Africa/Cairo', {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.dateTime) {
        const serverDate = new Date(data.dateTime);
        if (!isNaN(serverDate.getTime())) {
          return serverDate;
        }
      }
    }
  } catch (e) {
    console.warn('TimeAPI failed:', e);
  }

  // Strategy 4: Origin Server HEAD request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(window.location.origin + '?_t=' + Date.now(), {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const dateStr = res.headers.get('date');
    if (dateStr) {
      const serverDate = new Date(dateStr);
      if (!isNaN(serverDate.getTime())) {
        return serverDate;
      }
    }
  } catch (e) {
    console.warn('Origin date header fetch failed:', e);
  }

  return null;
}

/**
 * Update time anchor in localStorage & memory
 */
function saveTimeAnchor(serverDate: Date, deviceDate: Date) {
  const anchor: TimeAnchor = {
    serverMs: serverDate.getTime(),
    deviceMs: deviceDate.getTime(),
    perfMs: performance.now(),
    updatedAtIso: new Date().toISOString()
  };

  try {
    localStorage.setItem(TIME_ANCHOR_KEY, JSON.stringify(anchor));
    localStorage.setItem(LAST_KNOWN_SERVER_TIME_KEY, serverDate.getTime().toString());
  } catch (err) {
    console.warn('LocalStorage error saving time anchor:', err);
  }
}

/**
 * Check if the device time is synchronized with server/internet time.
 */
export async function checkDeviceTimeSync(): Promise<TimeSyncResult> {
  const deviceDate = new Date();
  const serverDate = await fetchServerTime();

  if (serverDate) {
    // Save updated anchor
    saveTimeAnchor(serverDate, deviceDate);

    const diffMs = Math.abs(deviceDate.getTime() - serverDate.getTime());
    const diffMinutes = Math.round(diffMs / (60 * 1000));

    const formattedDeviceDate = format(deviceDate, 'yyyy-MM-dd HH:mm');
    const formattedServerDate = format(serverDate, 'yyyy-MM-dd HH:mm');

    const deviceDay = format(deviceDate, 'yyyy-MM-dd');
    const serverDay = format(serverDate, 'yyyy-MM-dd');

    // Mismatch if drift > 5 mins OR if calendar days don't match
    if (diffMs > MAX_ALLOWED_DRIFT_MS || deviceDay !== serverDay) {
      return {
        isSync: false,
        deviceDate,
        serverDate,
        diffMinutes,
        reason: 'mismatch',
        formattedDeviceDate,
        formattedServerDate
      };
    }

    return {
      isSync: true,
      deviceDate,
      serverDate,
      diffMinutes,
      formattedDeviceDate,
      formattedServerDate
    };
  }

  // Fallback offline mode using stored anchor and monotonic clock
  try {
    const rawAnchor = localStorage.getItem(TIME_ANCHOR_KEY);
    if (rawAnchor) {
      const anchor: TimeAnchor = JSON.parse(rawAnchor);
      const currentPerf = performance.now();
      const elapsedPerfMs = currentPerf - anchor.perfMs;

      // Estimated true server time based on monotonic timer since last online sync
      const estimatedServerMs = anchor.serverMs + elapsedPerfMs;
      const estimatedServerDate = new Date(estimatedServerMs);

      // Expected device time if device clock wasn't touched
      const expectedDeviceMs = anchor.deviceMs + elapsedPerfMs;

      // Check if device clock was manually changed (drift between device clock and monotonic clock)
      const clockChangeDrift = Math.abs(deviceDate.getTime() - expectedDeviceMs);

      const formattedDeviceDate = format(deviceDate, 'yyyy-MM-dd HH:mm');
      const formattedServerDate = format(estimatedServerDate, 'yyyy-MM-dd HH:mm');

      const deviceDay = format(deviceDate, 'yyyy-MM-dd');
      const estimatedServerDay = format(estimatedServerDate, 'yyyy-MM-dd');

      // If phone clock rewound behind last known server time
      if (deviceDate.getTime() < anchor.serverMs - MAX_ALLOWED_DRIFT_MS) {
        return {
          isSync: false,
          deviceDate,
          serverDate: estimatedServerDate,
          diffMinutes: Math.round((anchor.serverMs - deviceDate.getTime()) / (60 * 1000)),
          reason: 'time_rewound',
          formattedDeviceDate,
          formattedServerDate
        };
      }

      // If user changed device clock manually while offline
      if (clockChangeDrift > MAX_ALLOWED_DRIFT_MS || deviceDay !== estimatedServerDay) {
        return {
          isSync: false,
          deviceDate,
          serverDate: estimatedServerDate,
          diffMinutes: Math.round(clockChangeDrift / (60 * 1000)),
          reason: 'manual_clock_tamper',
          formattedDeviceDate,
          formattedServerDate
        };
      }

      return {
        isSync: true,
        deviceDate,
        serverDate: estimatedServerDate,
        diffMinutes: Math.round(clockChangeDrift / (60 * 1000)),
        formattedDeviceDate,
        formattedServerDate
      };
    }
  } catch (e) {
    console.warn('Offline anchor check failed:', e);
  }

  // If no server connection and no previous anchor exists
  return {
    isSync: true,
    deviceDate,
    serverDate: null,
    diffMinutes: 0,
    formattedDeviceDate: format(deviceDate, 'yyyy-MM-dd HH:mm'),
    formattedServerDate: undefined
  };
}

/**
 * Get current verified server time (or estimated server time if offline)
 */
export async function getVerifiedServerTime(): Promise<{ date: string; time: string; fullDate: Date }> {
  const syncResult = await checkDeviceTimeSync();
  const dateObj = syncResult.serverDate || syncResult.deviceDate;

  return {
    date: format(dateObj, 'yyyy-MM-dd'),
    time: format(dateObj, 'HH:mm:ss'),
    fullDate: dateObj
  };
}

/**
 * Standardize any date string into YYYY-MM-DD ISO format for reliable comparison
 */
export function normalizeDateStringToISO(raw: any): string {
  if (!raw) return '';
  let str = String(raw).trim();
  if (str.includes('T')) {
    str = str.split('T')[0];
  } else if (str.includes(' ')) {
    str = str.split(' ')[0];
  }
  
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-M-D or YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        // D-M-YYYY or DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  return str.substring(0, 10);
}

/**
 * Fast test for real active network connectivity
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${window.location.origin}?_ping=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok || res.status < 500) {
      return true;
    }
  } catch (e) {
    // If local origin HEAD fails, try Supabase or fallback
  }

  // Fallback check via fetchServerTime
  const serverTime = await fetchServerTime();
  return serverTime !== null;
}
