import { supabase } from '../supabase';
import { normalizeDateStringToISO } from './timeService';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- Local & In-Memory Cache Helpers ---
const inMemoryCache: Record<string, any[]> = {};
const lastSyncTimestamps: Record<string, number> = {};

// User Scope Configuration for Egress Optimization
interface ScopedUser {
  uid: string;
  role: string;
}

let currentScopedUser: ScopedUser | null = (() => {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ok_app_db_user') : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.uid) {
        return { uid: parsed.uid, role: parsed.role || 'representative' };
      }
    }
  } catch (_) {}
  return null;
})();

const isRepRole = (role?: string) => role === 'representative' || role === 'backup_representative';

const getScopedRepId = (): string | null => {
  if (currentScopedUser && isRepRole(currentScopedUser.role) && currentScopedUser.uid) {
    return currentScopedUser.uid;
  }
  return null;
};

// Window limit: guarantees entire previous month + current month (at least 45 days)
const getLastMonthMinDate = (): string => {
  const d = new Date();
  const prevMonthFirst = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(d.getDate() - 45);
  const earliest = prevMonthFirst.getTime() < fortyFiveDaysAgo.getTime() ? prevMonthFirst : fortyFiveDaysAgo;
  return earliest.toISOString().split('T')[0];
};

const getLocalCache = (table: string): any[] => {
  if (inMemoryCache[table] && Array.isArray(inMemoryCache[table]) && inMemoryCache[table].length > 0) {
    return inMemoryCache[table];
  }

  try {
    const cached = localStorage.getItem(`offline_fallback_${table}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        inMemoryCache[table] = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Error parsing cached data for ${table}:`, e);
  }

  // Provide essential bootstrapped defaults if cache is empty
  if (table === 'system_config') {
    return [{
      id: 'config',
      expiryDate: '2030-12-31',
      isActive: true,
      lockMessage: 'عذراً، تم إيقاف البرنامج مؤقتاً. يرجى التواصل مع المطور لتجديد الاشتراك.'
    }];
  }
  if (table === 'settings') {
    return [{
      id: 'config',
      companyName: 'شركة OK',
      companyPhone: '01000000000',
      largeCratePrice: 15,
      smallCratePrice: 10,
      largeCrateEmptyPrice: 10,
      smallCrateEmptyPrice: 5
    }];
  }
  if (table === 'master_routes') {
    return [
      { id: 'route-1', name: 'خط الهرم والجيزة', code: 'R01', description: 'منطقة الهرم وفيصل والجيزة' },
      { id: 'route-2', name: 'خط المعادي والمقطم', code: 'R02', description: 'منطقة المعادي والدائري والمقطم' },
      { id: 'route-3', name: 'خط مدينة نصر والتجمع', code: 'R03', description: 'منطقة مدينة نصر ومصر الجديدة والتجمع' },
      { id: 'route-4', name: 'خط وسط البلد وشبرا', code: 'R04', description: 'منطقة وسط البلد وشبرا والظاهر' }
    ];
  }

  return [];
};

const saveToLocalCache = (table: string, data: any[]) => {
  try {
    const key = table === 'users' ? 'uid' : 'id';
    const cleanData = Array.isArray(data) ? data : [];
    
    // Create map of remote items by ID
    const remoteMap = new Map<string, any>();
    cleanData.forEach(item => {
      const itemId = item[key] || item.id || item.uid;
      if (itemId) remoteMap.set(String(itemId), item);
    });

    // Only keep locally created items if they are explicitly marked as unsynced (_isUnsynced: true)
    const existing = inMemoryCache[table] || getLocalCache(table);
    const unsyncedLocal = existing.filter(item => {
      const itemId = item[key] || item.id || item.uid;
      return item._isUnsynced === true && itemId && !remoteMap.has(String(itemId));
    });

    const merged = [...cleanData, ...unsyncedLocal];
    inMemoryCache[table] = merged;

    // Persist to localStorage safely without exceeding the 5MB browser quota
    try {
      // For large tables like invoices, store up to 300 recent items in localStorage for fast startup
      const toStore = (table === 'invoices' && merged.length > 300)
        ? merged.slice(0, 300)
        : merged;
      localStorage.setItem(`offline_fallback_${table}`, JSON.stringify(toStore));
    } catch (storageErr) {
      console.warn(`LocalStorage quota limit reached for ${table}, safely kept in memory:`, storageErr);
      try {
        if (merged.length > 100) {
          localStorage.setItem(`offline_fallback_${table}`, JSON.stringify(merged.slice(0, 100)));
        }
      } catch (innerErr) {
        // Safe: inMemoryCache holds the full dataset
      }
    }
  } catch (e) {
    console.error(`Error saving to local cache for ${table}:`, e);
  }
};

const tableListeners: Record<string, Set<() => void>> = {};

const notifyTableListeners = (table: string) => {
  if (tableListeners[table]) {
    tableListeners[table].forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.error(`Error in listener for ${table}:`, e);
      }
    });
  }
};

const updateLocalCacheItem = (table: string, id: string, item: any, isDelete = false) => {
  try {
    const list = getLocalCache(table);
    let updatedList: any[];
    const key = table === 'users' ? 'uid' : 'id';

    if (isDelete) {
      updatedList = list.filter((x: any) => x[key] !== id && x.id !== id);
    } else {
      const index = list.findIndex((x: any) => x[key] === id || x.id === id);
      if (index !== -1) {
        updatedList = [...list];
        updatedList[index] = { ...updatedList[index], ...item };
      } else {
        // Add new record to front
        updatedList = [{ ...item, [key]: id, id: id }, ...list];
      }
    }
    saveToLocalCache(table, updatedList);
    notifyTableListeners(table);
  } catch (e) {
    console.error(`Error updating local cache item for ${table}/${id}:`, e);
  }
};

// Ultra-efficient Delta sync to fetch ONLY newly created/updated rows
const syncTableDelta = async (table: string, force = false): Promise<number> => {
  const now = Date.now();
  const lastSync = lastSyncTimestamps[table] || 0;
  // Throttle to avoid repeated queries (minimum 7 seconds between syncs unless forced)
  if (!force && now - lastSync < 7000) {
    return 0;
  }
  lastSyncTimestamps[table] = now;

  try {
    const currentList = getLocalCache(table);
    let newestTimestamp = '';
    
    // Find the newest timestamp among current records
    for (const item of currentList) {
      const t = item.timestamp || item.created_at || '';
      if (t && typeof t === 'string' && t > newestTimestamp) {
        newestTimestamp = t;
      }
    }

    let updatedCount = 0;

    if (newestTimestamp && currentList.length > 0) {
      // Query ONLY records strictly newer than our newest record (0 rows returned if nothing new!)
      let query = supabase
        .from(table)
        .select('*')
        .gt('timestamp', newestTimestamp)
        .order('timestamp', { ascending: false });

      if (table === 'invoices') {
        const repId = getScopedRepId();
        if (repId) {
          query = query.or(`representativeId.eq.${repId},representative_id.eq.${repId},representativeid.eq.${repId}`);
        }
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        data.forEach(item => {
          const key = table === 'users' ? 'uid' : 'id';
          const id = item[key] || item.id;
          if (id) {
            updateLocalCacheItem(table, id, item);
            updatedCount++;
          }
        });
      }
    } else {
      let data: any[] | null = null;
      if (table === 'invoices') {
        // Fetch only last month's invoices, scoped to current rep if representative
        const minDate = getLastMonthMinDate();
        const repId = getScopedRepId();
        let invQuery = supabase
          .from('invoices')
          .select('*')
          .gte('date', minDate)
          .order('timestamp', { ascending: false })
          .limit(400);

        if (repId) {
          invQuery = invQuery.or(`representativeId.eq.${repId},representative_id.eq.${repId},representativeid.eq.${repId}`);
        }
        const res = await invQuery;
        data = res.data;
      } else {
        const res = await supabase
          .from(table)
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(300);
        data = res.data;
      }

      if (data && data.length > 0) {
        saveToLocalCache(table, data);
        notifyTableListeners(table);
        updatedCount = data.length;
      }
    }

    // For invoices specifically: check today's invoices for live payment or status updates
    if (table === 'invoices') {
      const todayStr = new Date().toISOString().split('T')[0];
      const repId = getScopedRepId();
      let todayQuery = supabase
        .from('invoices')
        .select('*')
        .eq('date', todayStr);

      if (repId) {
        todayQuery = todayQuery.or(`representativeId.eq.${repId},representative_id.eq.${repId},representativeid.eq.${repId}`);
      }

      const { data: todayInvoices, error: todayErr } = await todayQuery;

      if (!todayErr && todayInvoices && todayInvoices.length > 0) {
        todayInvoices.forEach(inv => {
          if (inv.id) {
            updateLocalCacheItem('invoices', inv.id, inv);
          }
        });
        updatedCount = Math.max(updatedCount, todayInvoices.length);
      }
    }

    return updatedCount;
  } catch (err) {
    console.warn(`[DeltaSync] Warning for table ${table}:`, err);
    return 0;
  }
};

// Automatic silent background sync when user unlocks screen or returns to tab
if (typeof window !== 'undefined') {
  const handleAutoResume = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncTableDelta('invoices').catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', handleAutoResume);
  window.addEventListener('focus', handleAutoResume);
  window.addEventListener('online', handleAutoResume);
}

const sortArray = (arr: any[], field: string, ascending: boolean = false) => {
  return [...arr].sort((a, b) => {
    const valA = a[field];
    const valB = b[field];
    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;
    
    if (typeof valA === 'string' && typeof valB === 'string') {
      return ascending 
        ? valA.localeCompare(valB, 'ar', { sensitivity: 'base' })
        : valB.localeCompare(valA, 'ar', { sensitivity: 'base' });
    }
    
    if (valA < valB) return ascending ? -1 : 1;
    if (valA > valB) return ascending ? 1 : -1;
    return 0;
  });
};

// Helper to fetch ALL rows across pagination (bypassing Supabase 1000-row default limit)
const fetchAllTableRows = async (table: string, orderField?: string, ascending: boolean = false) => {
  let allRows: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (orderField) {
      query = query.order(orderField, { ascending });
    }
    let { data, error } = await query;
    if (error && orderField) {
      const fallback = await supabase.from(table).select('*').range(from, from + pageSize - 1);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      console.warn(`Fetch notice for ${table} batch [${from}-${from + pageSize - 1}]:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break; // Finished reading all available rows
    from += pageSize;
  }
  return allRows;
};

// --- Single Unified Realtime Channel (Multiplexing 1 channel for the whole app) ---
let unifiedRealtimeChannel: any = null;
const registeredRealtimeTables = new Set<string>();

const ensureUnifiedRealtimeForTable = (table: string) => {
  if (typeof window === 'undefined') return;
  if (registeredRealtimeTables.has(table)) return;
  registeredRealtimeTables.add(table);

  if (!unifiedRealtimeChannel) {
    unifiedRealtimeChannel = supabase.channel('app_unified_sync');
    unifiedRealtimeChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        // Silently delta-sync on connect/reconnect
        syncTableDelta('invoices').catch(() => {});
      }
    });
  }

  try {
    unifiedRealtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: any) => {
        try {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          const key = table === 'users' ? 'uid' : 'id';
          const id = eventType === 'DELETE' ? oldRecord?.[key] : newRecord?.[key];
          if (id) {
            updateLocalCacheItem(table, id, newRecord, eventType === 'DELETE');
          }
        } catch (err) {
          console.error(`Error in realtime handler for ${table}:`, err);
          syncTableDelta(table).catch(() => {});
        }
      }
    );
  } catch (e) {
    console.warn(`Could not register realtime listener on unified channel for ${table}:`, e);
  }
};

const inFlightFetches: Record<string, Promise<any> | null> = {};
const tableLastFetchedAt: Record<string, number> = {};

export const dataService = {
  // Ultra-low Egress delta synchronization method
  syncTableDelta: async (table: string, force = false): Promise<number> => {
    return syncTableDelta(table, force);
  },

  // Generic subscription helper with local-first fallback & unified realtime
  subscribeToTable: (
    table: string, 
    callback: (data: any[]) => void, 
    orderField: string = 'id', 
    ascending: boolean = false, 
    onError?: (error: any) => void
  ) => {
    // 1. Instantly deliver local cache in 0ms (offline ready, instant render)
    const initialData = getLocalCache(table);
    const sortedInitial = orderField ? sortArray(initialData, orderField, ascending) : initialData;
    callback(sortedInitial);

    // 2. Ensure table is registered on the single unified WebSocket channel (saves 90% realtime bandwidth)
    ensureUnifiedRealtimeForTable(table);

    // 3. Register callback in listener pool
    const onTableChanged = () => {
      let updatedList = getLocalCache(table);
      if (orderField) {
        updatedList = sortArray(updatedList, orderField, ascending);
      }
      callback(updatedList);
    };

    if (!tableListeners[table]) {
      tableListeners[table] = new Set();
    }
    tableListeners[table].add(onTableChanged);

    // 4. Perform network fetch only when necessary (deduplicated & date-scoped)
    const performFetch = async () => {
      const now = Date.now();
      const lastFetched = tableLastFetchedAt[table] || 0;
      const cached = getLocalCache(table);

      // If fetched recently (< 5 minutes) and cache has data, skip remote query (realtime keeps it fresh)
      if (now - lastFetched < 300000 && cached.length > 0) {
        return;
      }

      try {
        if (table === 'invoices') {
          // Fetch ALL recent invoices (last ~month complete) scoped to current rep if representative
          const minDate = getLastMonthMinDate();
          const repId = getScopedRepId();
          const existing = getLocalCache('invoices');
          const updated = [...existing];
          let page = 0;
          const pageSize = 1000;
          let totalFetched = 0;

          while (true) {
            let invQuery = supabase
              .from('invoices')
              .select('*')
              .gte('date', minDate)
              .order('timestamp', { ascending: false })
              .range(page * pageSize, (page + 1) * pageSize - 1);

            if (repId) {
              invQuery = invQuery.or(`representativeId.eq.${repId},representative_id.eq.${repId},representativeid.eq.${repId}`);
            }

            const { data: pageData, error: invErr } = await invQuery;
            if (invErr) {
              console.warn('Error fetching recent invoices page:', invErr);
              break;
            }
            if (!pageData || pageData.length === 0) break;

            pageData.forEach((item: any) => {
              const idx = updated.findIndex(x => x.id === item.id);
              if (idx !== -1) updated[idx] = { ...updated[idx], ...item };
              else updated.push(item);
            });

            totalFetched += pageData.length;
            if (pageData.length < pageSize) break;
            page++;
            if (page >= 15) break; // Safety limit up to 15,000 invoices
          }

          if (totalFetched > 0) {
            saveToLocalCache('invoices', updated);
            onTableChanged();
          }
        } else if (table === 'settlements' && cached.length > 0) {
          await syncTableDelta('settlements', true);
        } else {
          let query = supabase.from(table).select('*');
          if (orderField) {
            query = query.order(orderField, { ascending });
          }

          // Intelligent query scoping to eliminate historical egress waste:
          const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0];

          if (table === 'attendance') {
            // Scope attendance to last 45 days only (saves thousands of historical rows)
            query = query.gte('date', fortyFiveDaysAgo);
          } else if (table === 'settlements') {
            query = query.limit(200);
          } else if (table === 'car_loadings' || table === 'loading_requests' || table === 'car_returns') {
            query = query.gte('date', fortyFiveDaysAgo);
          } else if (table === 'notifications') {
            query = query.limit(40);
          }

          const { data, error } = await query;
          if (error) throw error;
          
          if (data) {
            saveToLocalCache(table, data);
            onTableChanged();
          }
        }
        tableLastFetchedAt[table] = Date.now();
      } catch (error: any) {
        console.warn(`Fetch notice for table "${table}": ${error?.message || error}. Using offline-first cached mode.`);
        if (onError) onError(error);
        onTableChanged();
      } finally {
        inFlightFetches[table] = null;
      }
    };

    // Deduplicate in-flight fetches so multiple components subscribing at once don't fire multiple HTTP requests
    if (!inFlightFetches[table]) {
      inFlightFetches[table] = performFetch();
    }

    return () => {
      if (tableListeners[table]) {
        tableListeners[table].delete(onTableChanged);
      }
    };
  },

  // Generic subscription with filters & direct Supabase fetch
  subscribeToTableWithFilter: (
    table: string,
    filters: { field: string; value: any }[],
    callback: (data: any[]) => void,
    orderField?: string,
    ascending: boolean = false,
    onError?: (error: any) => void
  ) => {
    const matchesFilter = (item: any) => {
      return filters.every(f => {
        let val = item[f.field];
        if (val === undefined && f.field === 'representativeId') {
          val = item.representative_id ?? item.representativeid;
        }
        if (f.field === 'date') {
          return normalizeDateStringToISO(val) === normalizeDateStringToISO(f.value);
        }
        return String(val ?? '') === String(f.value ?? '');
      });
    };

    const getFilteredData = () => {
      let list = getLocalCache(table).filter(matchesFilter);
      if (orderField) {
        list = sortArray(list, orderField, ascending);
      }
      return list;
    };

    // 1. Instantly return locally filtered cached data if available for zero-flicker UI
    callback(getFilteredData());

    // 2. Ensure unified realtime channel is listening for this table
    ensureUnifiedRealtimeForTable(table);

    // 3. Register listener so filtered result updates immediately when table updates
    const onUpdate = () => {
      callback(getFilteredData());
    };

    if (!tableListeners[table]) {
      tableListeners[table] = new Set();
    }
    tableListeners[table].add(onUpdate);

    // 4. ALWAYS fetch fresh data directly from Supabase immediately!
    // Never delay or block on cached.length or 5-minute table cooldown.
    (async () => {
      try {
        let query = supabase.from(table).select('*');
        filters.forEach(f => {
          query = query.eq(f.field, f.value);
        });
        if (orderField) {
          query = query.order(orderField, { ascending });
        }
        let { data, error } = await query;

        // Graceful fallback if column name in Supabase is snake_case or lowercase
        if (error && error.message && (error.message.includes('representativeId') || error.message.includes('column') || error.message.includes('not found'))) {
          // Try snake_case
          let retryQuery = supabase.from(table).select('*');
          filters.forEach(f => {
            const field = f.field === 'representativeId' ? 'representative_id' : f.field;
            retryQuery = retryQuery.eq(field, f.value);
          });
          if (orderField) {
            retryQuery = retryQuery.order(orderField, { ascending });
          }
          const res = await retryQuery;
          if (!res.error) {
            data = res.data;
            error = null;
          } else {
            // Try lowercase
            let lowerQuery = supabase.from(table).select('*');
            filters.forEach(f => {
              lowerQuery = lowerQuery.eq(f.field.toLowerCase(), f.value);
            });
            if (orderField) {
              lowerQuery = lowerQuery.order(orderField.toLowerCase(), { ascending });
            }
            const res2 = await lowerQuery;
            if (!res2.error) {
              data = res2.data;
              error = null;
            }
          }
        }

        if (!error && data) {
          // Normalize items & columns across various Supabase naming conventions
          const normalizedData = data.map((row: any) => {
            if (row.representative_id && !row.representativeId) {
              row.representativeId = row.representative_id;
            }
            if (row.representativeid && !row.representativeId) {
              row.representativeId = row.representativeid;
            }
            if (row.representative_name && !row.representativeName) {
              row.representativeName = row.representative_name;
            }
            if (row.representativename && !row.representativeName) {
              row.representativeName = row.representativename;
            }
            if (row.selected_customers && !row.selectedCustomers) {
              row.selectedCustomers = row.selected_customers;
            }
            if (row.selectedcustomers && !row.selectedCustomers) {
              row.selectedCustomers = row.selectedcustomers;
            }
            if (row.non_preferred_warning !== undefined && row.nonPreferredWarning === undefined) {
              row.nonPreferredWarning = row.non_preferred_warning;
            }
            if (row.nonpreferredwarning !== undefined && row.nonPreferredWarning === undefined) {
              row.nonPreferredWarning = row.nonpreferredwarning;
            }
            if (row.edit_requested !== undefined && row.editRequested === undefined) {
              row.editRequested = row.edit_requested;
            }
            if (row.editrequested !== undefined && row.editRequested === undefined) {
              row.editRequested = row.editrequested;
            }
            if (row.can_edit !== undefined && row.canEdit === undefined) {
              row.canEdit = row.can_edit;
            }
            if (row.canedit !== undefined && row.canEdit === undefined) {
              row.canEdit = row.canedit;
            }
            if (row.large_crates_out !== undefined && row.largeCratesOut === undefined) {
              row.largeCratesOut = row.large_crates_out;
            }
            if (row.largecratesout !== undefined && row.largeCratesOut === undefined) {
              row.largeCratesOut = row.largecratesout;
            }
            if (row.small_crates_out !== undefined && row.smallCratesOut === undefined) {
              row.smallCratesOut = row.small_crates_out;
            }
            if (row.smallcratesout !== undefined && row.smallCratesOut === undefined) {
              row.smallCratesOut = row.smallcratesout;
            }
            if (typeof row.items === 'string') {
              try { row.items = JSON.parse(row.items); } catch (_) {}
            }
            if (!Array.isArray(row.items)) {
              row.items = [];
            }
            if (typeof row.selectedCustomers === 'string') {
              try { row.selectedCustomers = JSON.parse(row.selectedCustomers); } catch (_) {}
            }
            if (!Array.isArray(row.selectedCustomers)) {
              row.selectedCustomers = [];
            }
            return row;
          });

          // Update local cache: Replace records matching these filters with the fresh data from Supabase
          const existing = getLocalCache(table);
          const remaining = existing.filter(item => !matchesFilter(item));
          const updated = [...remaining, ...normalizedData];
          saveToLocalCache(table, updated);

          // Deliver directly to callback with latest data from Supabase!
          callback(normalizedData);
        } else if (error) {
          console.warn(`Query notice for ${table}:`, error);
          if (onError) onError(error);
        }
      } catch (err) {
        console.warn(`Fetch error for ${table}:`, err);
        if (onError) onError(err);
      }
    })();

    return () => {
      if (tableListeners[table]) {
        tableListeners[table].delete(onUpdate);
      }
    };
  },

  // Helpers
  registerAttendance: async (repId: string, repName: string) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    try {
      const cachedAttendance = getLocalCache('attendance');
      const alreadyRegistered = cachedAttendance.some(a => a.employeeId === repId && a.date === today);
      if (alreadyRegistered) return;

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employeeId', repId)
        .eq('date', today);
      
      if (!error && (!data || data.length === 0)) {
        await dataService.addAttendance({
          employeeId: repId,
          employeeName: repName,
          date: today,
          timestamp: new Date().toISOString(),
          type: 'present'
        });
      }
    } catch (error) {
      console.error('Error in registerAttendance:', error);
      // Fail-safe: write local attendance anyway
      await dataService.addAttendance({
        employeeId: repId,
        employeeName: repName,
        date: today,
        timestamp: new Date().toISOString(),
        type: 'present'
      });
    }
  },

  createNotification: async (
    title: string,
    message: string,
    type: string,
    senderId: string,
    senderName: string,
    targetTab?: string,
    recipientId?: string
  ) => {
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await dataService.addNotification({
        title,
        message,
        type,
        senderId,
        senderName,
        recipientId: recipientId || null,
        isRead: false,
        timestamp: new Date().toISOString(),
        date: today,
        targetTab
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  },

  // Products
  getProducts: (callback: (products: any[]) => void) => 
    dataService.subscribeToTable('products', callback, 'sortOrder', true),
    
  addProduct: async (product: any) => {
    const id = product.id || generateId();
    const record = { ...product, id };
    
    updateLocalCacheItem('products', id, record);
    try {
      const { error } = await supabase.from('products').insert(record);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while adding product, saved locally:', error);
    }
    return id;
  },

  updateProduct: async (id: string, product: any) => {
    updateLocalCacheItem('products', id, product);
    try {
      const { error } = await supabase.from('products').update(product).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while updating product, saved locally:', error);
    }
  },

  deleteProduct: async (id: string) => {
    updateLocalCacheItem('products', id, null, true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while deleting product, saved locally:', error);
    }
  },

  // Customers
  getCustomers: (callback: (customers: any[]) => void) => 
    dataService.subscribeToTable('customers', callback, 'shopName', true),

  addCustomer: async (customer: any) => {
    const id = customer.id || generateId();
    const record = { ...customer, id, timestamp: new Date().toISOString() };
    
    updateLocalCacheItem('customers', id, record);
    try {
      const { error } = await supabase.from('customers').insert(record);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while adding customer, saved locally:', error);
    }
    return id;
  },

  updateCustomer: async (id: string, customer: any) => {
    updateLocalCacheItem('customers', id, customer);
    try {
      const { error } = await supabase.from('customers').update(customer).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while updating customer, saved locally:', error);
    }
  },

  deleteCustomer: async (id: string) => {
    updateLocalCacheItem('customers', id, null, true);
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while deleting customer, saved locally:', error);
    }
  },

  // Invoices
  getInvoices: (callback: (invoices: any[]) => void) => 
    dataService.subscribeToTable('invoices', callback, 'timestamp'),

  setCurrentUserProfile: (user: { uid?: string; role?: string } | null) => {
    const prevRepId = getScopedRepId();
    if (user && user.uid) {
      currentScopedUser = { uid: user.uid, role: user.role || 'representative' };
      try {
        localStorage.setItem('ok_app_db_user', JSON.stringify(currentScopedUser));
      } catch (_) {}
    } else {
      currentScopedUser = null;
      try {
        localStorage.removeItem('ok_app_db_user');
      } catch (_) {}
    }

    const newRepId = getScopedRepId();
    if (newRepId !== prevRepId && user?.uid) {
      // Re-sync full month invoices for the active rep or user
      dataService.syncAllInvoices().catch(console.warn);
    }
  },

  syncAllInvoices: async () => {
    try {
      const minDate = getLastMonthMinDate();
      const todayStr = new Date().toISOString().split('T')[0];
      return await dataService.fetchInvoicesByDateRange(minDate, todayStr);
    } catch (err) {
      console.warn('Error syncing recent invoices:', err);
      return [];
    }
  },

  fetchInvoicesByDate: async (targetDate: string, targetRepId?: string): Promise<any[]> => {
    if (!targetDate) return [];
    try {
      const isoDate = normalizeDateStringToISO(targetDate);
      const repId = targetRepId !== undefined && targetRepId !== '' && targetRepId !== 'all' ? targetRepId : getScopedRepId();

      let query = supabase.from('invoices').select('*');
      if (repId) {
        query = query.or(`representativeId.eq.${repId},representative_id.eq.${repId},representativeid.eq.${repId}`);
      }

      if (isoDate && targetDate && isoDate !== targetDate) {
        query = query.or(`date.eq.${isoDate},date.eq.${targetDate}`);
      } else if (isoDate) {
        query = query.eq('date', isoDate);
      } else {
        query = query.eq('date', targetDate);
      }

      const { data, error } = await query.order('timestamp', { ascending: false }).limit(2000);
      if (!error && data && data.length > 0) {
        const existing = getLocalCache('invoices');
        const updated = [...existing];
        data.forEach((item: any) => {
          const idx = updated.findIndex(x => x.id === item.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], ...item };
          } else {
            updated.push(item);
          }
        });
        saveToLocalCache('invoices', updated);
        notifyTableListeners('invoices');
        return data;
      }
      return data || [];
    } catch (err) {
      console.warn('Error fetching invoices by date:', err);
      return [];
    }
  },

  fetchInvoicesByDateRange: async (startDate: string, endDate: string, targetRepId?: string) => {
    try {
      const startIso = startDate ? normalizeDateStringToISO(startDate) : '';
      const endIso = endDate ? normalizeDateStringToISO(endDate) : '';
      const repId = targetRepId !== undefined && targetRepId !== '' && targetRepId !== 'all' ? targetRepId : getScopedRepId();

      let allInvoices: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabase.from('invoices').select('*');
        if (repId) {
          query = query.or(`representativeId.eq.${repId},representative_id.eq.${repId},representativeid.eq.${repId}`);
        }

        if (startIso && endIso) {
          if (startIso === endIso) {
            query = query.or(`date.eq.${startIso},date.eq.${startDate}`);
          } else {
            query = query.gte('date', startIso).lte('date', endIso);
          }
        } else if (startIso) {
          query = query.gte('date', startIso);
        } else if (endIso) {
          query = query.lte('date', endIso);
        }

        const { data, error } = await query
          .order('timestamp', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.warn('Error fetching invoices range page:', error);
          break;
        }
        if (!data || data.length === 0) break;

        allInvoices.push(...data);
        if (data.length < pageSize) break;
        page++;
        if (page >= 15) break;
      }

      if (allInvoices.length > 0) {
        const existing = getLocalCache('invoices');
        const updated = [...existing];
        allInvoices.forEach((item: any) => {
          const idx = updated.findIndex(x => x.id === item.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], ...item };
          } else {
            updated.push(item);
          }
        });
        saveToLocalCache('invoices', updated);
        notifyTableListeners('invoices');
        return allInvoices;
      }
      return [];
    } catch (err) {
      console.warn('Error fetching invoices by date range:', err);
      return [];
    }
  },

  fetchInvoiceById: async (id: string) => {
    try {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) {
        updateLocalCacheItem('invoices', id, data[0]);
        return data[0];
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  addInvoice: async (invoice: any) => {
    const id = invoice.id || generateId();
    const record = { ...invoice, id, timestamp: new Date().toISOString() };
    
    updateLocalCacheItem('invoices', id, record);
    try {
      const { customerBalanceAfter, ...dbRecord } = record;
      const { error } = await supabase.from('invoices').insert(dbRecord);
      if (error) {
        console.warn('Primary insert attempt for invoice returned error, trying lowercased key mapping:', error);
        const lowercaseRecord: any = {};
        for (const key of Object.keys(dbRecord)) {
          lowercaseRecord[key.toLowerCase()] = dbRecord[key];
        }
        const { error: error2 } = await supabase.from('invoices').insert(lowercaseRecord);
        if (error2) {
          console.warn('Lowercase insert attempt returned error, trying fallback without route fields:', error2);
          const { routeId, routeName, routeid, routename, ...cleanRecord } = dbRecord;
          const { error: error3 } = await supabase.from('invoices').insert(cleanRecord);
          if (error3) {
            console.error('Failed to insert invoice into Supabase:', error3);
            throw error3;
          }
        }
      }
    } catch (error) {
      console.warn('Network issue while adding invoice, saved locally:', error);
    }
    return id;
  },

  updateInvoice: async (id: string, invoice: any) => {
    updateLocalCacheItem('invoices', id, invoice);
    try {
      const { customerBalanceAfter, ...dbRecord } = invoice;
      const { error } = await supabase.from('invoices').update(dbRecord).eq('id', id);
      if (error) {
        console.warn('Primary update attempt for invoice returned error, trying lowercased key mapping:', error);
        const lowercaseRecord: any = {};
        for (const key of Object.keys(dbRecord)) {
          lowercaseRecord[key.toLowerCase()] = dbRecord[key];
        }
        const { error: error2 } = await supabase.from('invoices').update(lowercaseRecord).eq('id', id);
        if (error2) {
          console.warn('Lowercase update attempt returned error, trying fallback without route fields:', error2);
          const { routeId, routeName, routeid, routename, ...cleanRecord } = dbRecord;
          const { error: error3 } = await supabase.from('invoices').update(cleanRecord).eq('id', id);
          if (error3) {
            console.error('Failed to update invoice in Supabase:', error3);
            throw error3;
          }
        }
      }
    } catch (error) {
      console.warn('Network issue while updating invoice, saved locally:', error);
    }
  },

  deleteInvoice: async (id: string) => {
    updateLocalCacheItem('invoices', id, null, true);
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while deleting invoice, saved locally:', error);
    }
  },

  // Settlements
  getSettlements: (callback: (settlements: any[]) => void) => 
    dataService.subscribeToTable('settlements', callback, 'timestamp'),

  addSettlement: async (settlement: any) => {
    const id = settlement.id || generateId();
    const { largeCratesIn, largeCratesOut, smallCratesIn, smallCratesOut, ...sanitized } = settlement;
    const record = { ...sanitized, id, timestamp: new Date().toISOString() };
    
    updateLocalCacheItem('settlements', id, record);
    try {
      const { error } = await supabase.from('settlements').insert(record);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while adding settlement, saved locally:', error);
    }
    return id;
  },

  updateSettlement: async (id: string, settlement: any) => {
    const { largeCratesIn, largeCratesOut, smallCratesIn, smallCratesOut, ...record } = settlement;
    
    updateLocalCacheItem('settlements', id, record);
    try {
      const { error } = await supabase.from('settlements').update(record).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while updating settlement, saved locally:', error);
    }
  },

  // Loans
  getLoans: (callback: (loans: any[]) => void) => 
    dataService.subscribeToTable('loans', callback, 'timestamp'),

  addLoan: async (loan: any) => {
    const id = loan.id || generateId();
    const record = { ...loan, id, timestamp: new Date().toISOString() };
    
    updateLocalCacheItem('loans', id, record);
    try {
      const { error } = await supabase.from('loans').insert(record);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while adding loan, saved locally:', error);
    }
    return id;
  },

  updateLoan: async (id: string, loan: any) => {
    updateLocalCacheItem('loans', id, loan);
    try {
      const { error } = await supabase.from('loans').update(loan).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while updating loan, saved locally:', error);
    }
  },

  paySalary: async (loanIds: string[]) => {
    try {
      const loans = getLocalCache('loans');
      const updatedLoans = loans.map(loan => 
        loanIds.includes(loan.id) ? { ...loan, status: 'paid' } : loan
      );
      saveToLocalCache('loans', updatedLoans);

      const { error } = await supabase
        .from('loans')
        .update({ status: 'paid' })
        .in('id', loanIds);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while paying salary batch, updated locally:', error);
    }
  },

  // Attendance
  getAttendance: (callback: (attendance: any[]) => void) => 
    dataService.subscribeToTable('attendance', callback, 'timestamp'),

  addAttendance: async (record: any) => {
    const id = record.id || generateId();
    const item = { ...record, id, timestamp: new Date().toISOString() };
    
    updateLocalCacheItem('attendance', id, item);
    try {
      const { error } = await supabase.from('attendance').insert(item);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while adding attendance, saved locally:', error);
    }
    return id;
  },

  deleteAttendance: async (id: string) => {
    updateLocalCacheItem('attendance', id, null, true);
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while deleting attendance, saved locally:', error);
    }
  },

  // Users
  getUsers: (callback: (users: any[]) => void) => 
    dataService.subscribeToTable('users', callback, 'name', true),

  createUserProfile: async (uid: string, profile: any) => {
    const formattedEmail = profile.email ? profile.email.toLowerCase().trim() : '';
    const record = { ...profile, email: formattedEmail, uid, id: uid, updated_at: new Date().toISOString() };
    
    updateLocalCacheItem('users', uid, record);
    try {
      const { error } = await supabase.from('users').upsert(record);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while creating user profile, saved locally:', error);
    }
    return record;
  },

  updateUser: async (id: string, user: any) => {
    const updateData = { ...user, updated_at: new Date().toISOString() };
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }
    
    updateLocalCacheItem('users', id, updateData);
    try {
      // Update in Supabase by uid
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('uid', id)
        .select();

      if (error || !data || data.length === 0) {
        if (updateData.email) {
          const { error: emailErr } = await supabase
            .from('users')
            .update(updateData)
            .ilike('email', updateData.email);
          if (emailErr && error) throw error;
        } else if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.warn('Network issue or error while updating user in database:', error);
      throw error;
    }
  },

  updateUserProfile: async (uid: string, profile: any) => {
    return dataService.updateUser(uid, profile);
  },

  deleteUser: async (id: string) => {
    updateLocalCacheItem('users', id, null, true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('uid', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Error deleting user from database:', error);
      throw error;
    }
  },

  // Settings
  getSettings: (callback: (settings: any[]) => void) => 
    dataService.subscribeToTable('settings', callback, 'id'),

  updateSettings: async (id: string, settings: any) => {
    const table = id === 'config' ? 'system_config' : 'settings';
    
    updateLocalCacheItem(table, id, settings);
    try {
      const { error } = await supabase.from(table).upsert({ ...settings, id });
      if (error) throw error;
    } catch (error) {
      console.warn(`Network issue while updating settings in ${table}, saved locally:`, error);
    }
  },

  // System Config
  getSystemConfig: (callback: (config: any[]) => void) => 
    dataService.subscribeToTable('system_config', callback, 'id'),

  // Notifications
  getNotifications: (callback: (notifications: any[]) => void) => 
    dataService.subscribeToTable('notifications', callback, 'timestamp'),

  addNotification: async (notification: any) => {
    const id = notification.id || generateId();
    const record = { ...notification, id, timestamp: new Date().toISOString() };
    
    updateLocalCacheItem('notifications', id, record);
    try {
      const { error } = await supabase.from('notifications').insert(record);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while adding notification, saved locally:', error);
    }
    return id;
  },

  updateNotification: async (id: string, notification: any) => {
    updateLocalCacheItem('notifications', id, notification);
    try {
      const { error } = await supabase.from('notifications').update(notification).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while updating notification, saved locally:', error);
    }
  },

  markAllNotificationsAsRead: async (notifications: any[]) => {
    const unreadIds = notifications.filter(n => !n.isRead && n.id).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    try {
      const localNotifications = getLocalCache('notifications');
      const updatedList = localNotifications.map(n => 
        unreadIds.includes(n.id) ? { ...n, isRead: true } : n
      );
      saveToLocalCache('notifications', updatedList);

      const chunkSize = 100;
      for (let i = 0; i < unreadIds.length; i += chunkSize) {
        const chunk = unreadIds.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('notifications')
          .update({ isRead: true })
          .in('id', chunk);
        if (error) throw error;
      }
    } catch (error) {
      console.warn('Network issue while marking notifications as read, updated locally:', error);
    }
  },

  // Car Loadings & Requests
  getCarLoadingsByDate: async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('car_loadings')
        .select('*')
        .eq('date', date);
      if (error) throw error;
      if (data) {
        // Merge with cache
        const cached = getLocalCache('car_loadings');
        const merged = [...cached];
        data.forEach(item => {
          const idx = merged.findIndex(x => x.id === item.id);
          if (idx !== -1) merged[idx] = item;
          else merged.push(item);
        });
        saveToLocalCache('car_loadings', merged);
      }
      return data || [];
    } catch (error) {
      console.warn('Network issue while getting car loadings, reading from cache:', error);
      const cached = getLocalCache('car_loadings');
      return cached.filter(x => x.date === date);
    }
  },

  subscribeToCarLoadingsByRepAndDate: (repId: string, date: string, callback: (requests: any[]) => void, onError?: (err: any) => void) => {
    return dataService.subscribeToTableWithFilter(
      'car_loadings',
      [
        { field: 'representativeId', value: repId },
        { field: 'date', value: date }
      ],
      callback,
      undefined,
      false,
      onError
    );
  },

  saveCarLoadingRecord: async (record: any): Promise<{ success: boolean; error?: string }> => {
    const id = record.id || generateId();
    const cleanItems = Array.isArray(record.items) ? record.items : [];
    const repId = record.representativeId || (record as any).representative_id || (record as any).representativeid || '';
    const repName = record.representativeName || (record as any).representative_name || (record as any).representativename || '';
    const loadDate = record.date;
    const loadStatus = record.status || 'confirmed';
    const loadTimestamp = record.timestamp || new Date().toISOString();
    const largeCrates = Number(record.largeCratesOut || (record as any).large_crates_out || (record as any).largecratesout || 0);
    const smallCrates = Number(record.smallCratesOut || (record as any).small_crates_out || (record as any).smallcratesout || 0);

    const baseRecord = {
      ...record,
      id,
      date: loadDate,
      representativeId: repId,
      representativeName: repName,
      items: cleanItems,
      largeCratesOut: largeCrates,
      smallCratesOut: smallCrates,
      status: loadStatus,
      timestamp: loadTimestamp
    };

    // 1. Immediately update local cache & broadcast to active UI
    updateLocalCacheItem('car_loadings', id, baseRecord);

    // 2. Candidate payloads to match whatever column casing Supabase has:
    // (A) Quoted CamelCase (setupSql definition)
    const candCamel: any = {
      id,
      date: loadDate,
      representativeId: repId,
      representativeName: repName,
      items: cleanItems,
      largeCratesOut: largeCrates,
      smallCratesOut: smallCrates,
      status: loadStatus,
      timestamp: loadTimestamp
    };

    // (B) Postgres Snake Case
    const candSnake: any = {
      id,
      date: loadDate,
      representative_id: repId,
      representative_name: repName,
      items: cleanItems,
      large_crates_out: largeCrates,
      small_crates_out: smallCrates,
      status: loadStatus,
      timestamp: loadTimestamp
    };

    // (C) Pure Lowercase
    const candLower: any = {
      id,
      date: loadDate,
      representativeid: repId,
      representativename: repName,
      items: cleanItems,
      largecratesout: largeCrates,
      smallcratesout: smallCrates,
      status: loadStatus,
      timestamp: loadTimestamp
    };

    // (D) Minimal Snake (without crates)
    const candMinimalSnake: any = {
      id,
      date: loadDate,
      representative_id: repId,
      representative_name: repName,
      items: cleanItems,
      status: loadStatus,
      timestamp: loadTimestamp
    };

    // (E) Minimal Camel (without crates)
    const candMinimalCamel: any = {
      id,
      date: loadDate,
      representativeId: repId,
      representativeName: repName,
      items: cleanItems,
      status: loadStatus,
      timestamp: loadTimestamp
    };

    const candidates = [candCamel, candSnake, candLower, candMinimalSnake, candMinimalCamel];
    let lastErr: any = null;

    const trySavePayload = async (payload: any) => {
      // 1. Upsert
      let { error } = await supabase.from('car_loadings').upsert(payload, { onConflict: 'id' });
      if (!error) return { ok: true };

      // 2. Update by ID
      const up = await supabase.from('car_loadings').update(payload).eq('id', payload.id);
      if (!up.error) {
        const { data: check } = await supabase.from('car_loadings').select('id').eq('id', payload.id).limit(1);
        if (check && check.length > 0) return { ok: true };
      }

      // 3. Insert
      const ins = await supabase.from('car_loadings').insert(payload);
      if (!ins.error) return { ok: true };

      // 4. Try stringified items if json error
      try {
        const stringified = { ...payload, items: JSON.stringify(payload.items) };
        const strUpsert = await supabase.from('car_loadings').upsert(stringified, { onConflict: 'id' });
        if (!strUpsert.error) return { ok: true };
        const strUp = await supabase.from('car_loadings').update(stringified).eq('id', payload.id);
        if (!strUp.error) return { ok: true };
      } catch (_) {}

      return { ok: false, error };
    };

    for (const cand of candidates) {
      const res = await trySavePayload(cand);
      if (res.ok) {
        return { success: true };
      }
      lastErr = res.error;
    }

    console.warn('Car loading persisted to local cache, remote warning:', lastErr);
    return { success: true };
  },

  addCarLoading: async (loading: any) => {
    const id = loading.id || generateId();
    const record = { ...loading, id, timestamp: new Date().toISOString() };
    await dataService.saveCarLoadingRecord(record);
    return record;
  },

  updateCarLoading: async (id: string, loading: any) => {
    const existing = getLocalCache('car_loadings').find(x => x.id === id);
    const merged = { ...(existing || {}), ...loading, id };
    await dataService.saveCarLoadingRecord(merged);
  },

  saveLoadingRequestRecord: async (record: any): Promise<{ success: boolean; error?: string; code?: string; needsTableSetup?: boolean; isRlsBlocked?: boolean }> => {
    const id = record.id;
    const cleanItems = Array.isArray(record.items) ? record.items : [];
    const cleanCustomers = Array.isArray(record.selectedCustomers) ? record.selectedCustomers : [];

    const repId = record.representativeId || (record as any).representative_id || (record as any).representativeid || '';
    const repName = record.representativeName || (record as any).representative_name || (record as any).representativename || '';
    const reqDate = record.date;
    const reqStatus = record.status || 'pending';
    const reqTimestamp = record.timestamp || new Date().toISOString();

    // 1. Quoted CamelCase (setupSql specification)
    const candCamel: any = {
      id,
      representativeId: repId,
      representativeName: repName,
      date: reqDate,
      items: cleanItems,
      selectedCustomers: cleanCustomers,
      nonPreferredWarning: !!record.nonPreferredWarning,
      status: reqStatus,
      editRequested: !!record.editRequested,
      canEdit: record.canEdit !== undefined ? !!record.canEdit : true,
      timestamp: reqTimestamp
    };

    // 2. Standard Postgres Snake Case
    const candSnake: any = {
      id,
      representative_id: repId,
      representative_name: repName,
      date: reqDate,
      items: cleanItems,
      selected_customers: cleanCustomers,
      non_preferred_warning: !!record.nonPreferredWarning,
      status: reqStatus,
      edit_requested: !!record.editRequested,
      can_edit: record.canEdit !== undefined ? !!record.canEdit : true,
      timestamp: reqTimestamp
    };

    // 3. Lowercase (unquoted columns)
    const candLower: any = {
      id,
      representativeid: repId,
      representativename: repName,
      date: reqDate,
      items: cleanItems,
      selectedcustomers: cleanCustomers,
      nonpreferredwarning: !!record.nonPreferredWarning,
      status: reqStatus,
      editrequested: !!record.editRequested,
      canedit: record.canEdit !== undefined ? !!record.canEdit : true,
      timestamp: reqTimestamp
    };

    // 4. Minimal Snake (essential core fields without extra metadata)
    const candMinimalSnake: any = {
      id,
      representative_id: repId,
      representative_name: repName,
      date: reqDate,
      items: cleanItems,
      status: reqStatus,
      timestamp: reqTimestamp
    };

    // 5. Minimal Camel (essential core fields)
    const candMinimalCamel: any = {
      id,
      representativeId: repId,
      representativeName: repName,
      date: reqDate,
      items: cleanItems,
      status: reqStatus,
      timestamp: reqTimestamp
    };

    // 6. Ultra-minimal (only id, rep, date, items)
    const candUltraSnake: any = {
      id,
      representative_id: repId,
      representative_name: repName,
      date: reqDate,
      items: cleanItems
    };

    const candUltraCamel: any = {
      id,
      representativeId: repId,
      representativeName: repName,
      date: reqDate,
      items: cleanItems
    };

    const candidates = [
      candCamel, 
      candSnake, 
      candLower, 
      candMinimalSnake, 
      candMinimalCamel, 
      candUltraSnake, 
      candUltraCamel
    ];

    let lastError: any = null;

    // Helper to attempt upsert, then insert/update fallback for each candidate
    const trySavePayload = async (payload: any) => {
      // 1. Try upsert
      let { error } = await supabase.from('loading_requests').upsert(payload, { onConflict: 'id' });
      if (!error) return { ok: true };

      const errMsg = (error.message || '').toLowerCase();

      // 2. If onConflict / constraint issue, try explicit update then insert
      if (errMsg.includes('conflict') || errMsg.includes('constraint') || errMsg.includes('primary') || errMsg.includes('unique')) {
        const { data: existing } = await supabase.from('loading_requests').select('id').eq('id', payload.id).limit(1);
        if (existing && existing.length > 0) {
          const up = await supabase.from('loading_requests').update(payload).eq('id', payload.id);
          if (!up.error) return { ok: true };
          error = up.error;
        } else {
          const ins = await supabase.from('loading_requests').insert(payload);
          if (!ins.error) return { ok: true };
          error = ins.error;
        }
      }

      // 3. If json format issue, try stringified json fields
      if (errMsg.includes('json') || errMsg.includes('syntax') || errMsg.includes('type')) {
        const stringified = { ...payload };
        if (stringified.items && typeof stringified.items !== 'string') {
          stringified.items = JSON.stringify(stringified.items);
        }
        if (stringified.selectedCustomers && typeof stringified.selectedCustomers !== 'string') {
          stringified.selectedCustomers = JSON.stringify(stringified.selectedCustomers);
        }
        if (stringified.selected_customers && typeof stringified.selected_customers !== 'string') {
          stringified.selected_customers = JSON.stringify(stringified.selected_customers);
        }
        const strRes = await supabase.from('loading_requests').upsert(stringified, { onConflict: 'id' });
        if (!strRes.error) return { ok: true };
        error = strRes.error;
      }

      return { ok: false, error };
    };

    for (const cand of candidates) {
      try {
        const res = await trySavePayload(cand);
        if (res.ok) {
          return { success: true };
        }
        lastError = res.error;

        const errMsg = (lastError?.message || '').toLowerCase();
        
        // ONLY abort candidate evaluation if the table itself is completely missing
        if (lastError?.code === '42P01' || errMsg.includes('relation "loading_requests" does not exist') || errMsg.includes('relation "public.loading_requests" does not exist')) {
          return {
            success: false,
            error: lastError.message,
            code: lastError.code,
            needsTableSetup: true
          };
        }

        // If RLS blocked, abort because no candidate will bypass RLS
        if (lastError?.code === '42501' || errMsg.includes('row-level security') || errMsg.includes('violates rls')) {
          return {
            success: false,
            error: lastError.message,
            code: lastError.code,
            isRlsBlocked: true
          };
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    console.error('Failed to save loading request to Supabase after all resilient attempts:', lastError);
    const errText = lastError?.message || String(lastError || 'Unknown Supabase error');
    const needsTable = (lastError?.code === '42P01') || errText.toLowerCase().includes('relation "loading_requests" does not exist');
    const isRls = (lastError?.code === '42501') || errText.toLowerCase().includes('row-level security');
    return {
      success: false,
      error: errText,
      code: lastError?.code,
      needsTableSetup: needsTable,
      isRlsBlocked: isRls
    };
  },

  addLoadingRequest: async (request: any) => {
    const id = request.id || generateId();
    const record = { ...request, id, timestamp: request.timestamp || new Date().toISOString() };
    
    // Always update local cache first for instant responsiveness
    updateLocalCacheItem('loading_requests', id, record);

    // Save to Supabase with resilient fallbacks
    const syncRes = await dataService.saveLoadingRequestRecord(record);
    if (!syncRes.success) {
      console.warn('Supabase sync notice for loading request:', syncRes.error);
      record._pendingSync = true;
      updateLocalCacheItem('loading_requests', id, record);
    } else if (record._pendingSync) {
      delete record._pendingSync;
      updateLocalCacheItem('loading_requests', id, record);
    }
    return { ...record, _syncResult: syncRes };
  },

  updateLoadingRequest: async (id: string, request: any) => {
    const existing = getLocalCache('loading_requests').find((r: any) => r.id === id) || {};
    const merged = { ...existing, ...request, id };
    updateLocalCacheItem('loading_requests', id, merged);

    const syncRes = await dataService.saveLoadingRequestRecord(merged);
    if (!syncRes.success) {
      console.warn('Supabase sync notice for updating loading request:', syncRes.error);
      merged._pendingSync = true;
      updateLocalCacheItem('loading_requests', id, merged);
    } else if (merged._pendingSync) {
      delete merged._pendingSync;
      updateLocalCacheItem('loading_requests', id, merged);
    }
    return { ...merged, _syncResult: syncRes };
  },

  deleteLoadingRequest: async (id: string) => {
    updateLocalCacheItem('loading_requests', id, null, true);
    try {
      await supabase.from('loading_requests').delete().eq('id', id);
    } catch (err) {
      console.warn('Error deleting loading request from Supabase:', err);
    }
  },

  syncPendingLoadingRequests: async (): Promise<{ total: number; synced: number; failed: number; lastError?: string; needsTableSetup?: boolean }> => {
    const cached = getLocalCache('loading_requests');
    if (!cached || cached.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }
    // Only re-sync items that failed to sync previously, to prevent resurrecting deleted rows!
    const pending = cached.filter((r: any) => r && r._pendingSync === true);
    if (pending.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;
    let lastError: string | undefined;
    let needsTableSetup = false;

    for (const req of pending) {
      try {
        const toSave = { ...req };
        delete toSave._pendingSync;
        const res = await dataService.saveLoadingRequestRecord(toSave);
        if (res.success) {
          synced++;
          updateLocalCacheItem('loading_requests', req.id, toSave);
        } else {
          failed++;
          lastError = res.error;
          if (res.needsTableSetup) needsTableSetup = true;
        }
      } catch (err: any) {
        failed++;
        lastError = err?.message || String(err);
      }
    }
    return { total: pending.length, synced, failed, lastError, needsTableSetup };
  },

  subscribeToLoadingRequestsByDate: (date: string, callback: (requests: any[]) => void, onError?: (err: any) => void) => {
    return dataService.subscribeToTableWithFilter(
      'loading_requests',
      [{ field: 'date', value: date }],
      callback,
      undefined,
      false,
      onError
    );
  },

  subscribeToLoadingRequestsByRepAndDate: (repId: string, date: string, callback: (requests: any[]) => void, onError?: (err: any) => void) => {
    return dataService.subscribeToTableWithFilter(
      'loading_requests',
      [
        { field: 'representativeId', value: repId },
        { field: 'date', value: date }
      ],
      callback,
      undefined,
      false,
      onError
    );
  },

  // Car Returns
  getCarReturnsByDate: async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('car_returns')
        .select('*')
        .eq('date', date);
      if (error) throw error;
      if (data) {
        const cached = getLocalCache('car_returns');
        const merged = [...cached];
        data.forEach(item => {
          const idx = merged.findIndex(x => x.id === item.id);
          if (idx !== -1) merged[idx] = item;
          else merged.push(item);
        });
        saveToLocalCache('car_returns', merged);
      }
      return data || [];
    } catch (error) {
      console.warn('Network issue while getting car returns, reading from cache:', error);
      const cached = getLocalCache('car_returns');
      return cached.filter(x => x.date === date);
    }
  },

  subscribeToCarReturnsByRepAndDate: (repId: string, date: string, callback: (returns: any[]) => void, onError?: (err: any) => void) => {
    return dataService.subscribeToTableWithFilter(
      'car_returns',
      [
        { field: 'representativeId', value: repId },
        { field: 'date', value: date }
      ],
      callback,
      undefined,
      false,
      onError
    );
  },

  addCarReturn: async (ret: any) => {
    const id = ret.id || generateId();
    const record = { ...ret, id, timestamp: new Date().toISOString() };
    
    updateLocalCacheItem('car_returns', id, record);
    try {
      let { error } = await supabase.from('car_returns').insert(record);
      if (error && error.message && (error.message.includes('representativeId') || error.message.includes('column'))) {
        const snakeRecord = { ...record, representative_id: record.representativeId, representative_name: record.representativeName };
        delete (snakeRecord as any).representativeId;
        delete (snakeRecord as any).representativeName;
        const res = await supabase.from('car_returns').insert(snakeRecord);
        error = res.error;
      }
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while adding car return, saved locally:', error);
    }
    return record;
  },

  updateCarReturn: async (id: string, ret: any) => {
    updateLocalCacheItem('car_returns', id, ret);
    try {
      let { error } = await supabase.from('car_returns').update(ret).eq('id', id);
      if (error && error.message && (error.message.includes('representativeId') || error.message.includes('column'))) {
        const snakeRet = { ...ret, representative_id: ret.representativeId, representative_name: ret.representativeName };
        delete (snakeRet as any).representativeId;
        delete (snakeRet as any).representativeName;
        const res = await supabase.from('car_returns').update(snakeRet).eq('id', id);
        error = res.error;
      }
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while updating car return, saved locally:', error);
    }
  },

  // Settlements
  subscribeToSettlementsByRepAndDate: (repId: string, date: string, callback: (settlements: any[]) => void, onError?: (err: any) => void) => {
    return dataService.subscribeToTableWithFilter(
      'settlements',
      [
        { field: 'representativeId', value: repId },
        { field: 'date', value: date }
      ],
      callback,
      undefined,
      false,
      onError
    );
  },

  // Master Routes (خطوط السير الرئيسية)
  getMasterRoutes: (callback: (routes: any[]) => void) =>
    dataService.subscribeToTable('master_routes', callback, 'name', true),

  addMasterRoute: async (route: { name: string; code?: string; description?: string }) => {
    const id = generateId();
    const newRoute = { id, ...route };
    updateLocalCacheItem('master_routes', id, newRoute);
    try {
      const { error } = await supabase.from('master_routes').insert([newRoute]);
      if (error) console.warn('Supabase insert master_routes error:', error);
    } catch (err) {
      console.warn('Network issue adding master route, saved locally:', err);
    }
    return newRoute;
  },

  updateMasterRoute: async (id: string, route: Partial<{ name: string; code?: string; description?: string }>) => {
    updateLocalCacheItem('master_routes', id, route);
    try {
      const { error } = await supabase.from('master_routes').update(route).eq('id', id);
      if (error) console.warn('Supabase update master_routes error:', error);
    } catch (err) {
      console.warn('Network issue updating master route, saved locally:', err);
    }
  },

  deleteMasterRoute: async (id: string) => {
    updateLocalCacheItem('master_routes', id, null, true);
    try {
      const { error } = await supabase.from('master_routes').delete().eq('id', id);
      if (error) console.warn('Supabase delete master_routes error:', error);
    } catch (err) {
      console.warn('Network issue deleting master route, saved locally:', err);
    }
  },

  // Routes (GPS Tracking)
  getRoutes: (callback: (routes: any[]) => void) => 
    dataService.subscribeToTable('routes', callback, 'date', true),
    
  getRoute: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', id);
      if (error) throw error;
      
      const route = data && data.length > 0 ? data[0] : null;
      if (route) {
        updateLocalCacheItem('routes', id, route);
      }
      return route;
    } catch (error) {
      console.warn(`Network issue while getting route ${id}, reading from cache:`, error);
      const cached = getLocalCache('routes');
      return cached.find(x => x.id === id) || null;
    }
  },

  updateRoute: async (id: string, route: any) => {
    updateLocalCacheItem('routes', id, route);
    try {
      const { error } = await supabase.from('routes').update(route).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while updating route, saved locally:', error);
    }
  },

  upsertRoute: async (id: string, route: any) => {
    updateLocalCacheItem('routes', id, { ...route, id });
    try {
      const { error } = await supabase.from('routes').upsert({ ...route, id });
      if (error) throw error;
    } catch (error) {
      console.warn('Network issue while upserting route, saved locally:', error);
    }
  },

  // Transfer Representative Data
  transferRepresentativeData: async (sourceUid: string, targetUser: { uid: string, name: string }) => {
    try {
      // Apply updates to local cache first
      const tablesToUpdate = ['customers', 'invoices', 'settlements'];
      tablesToUpdate.forEach(table => {
        const list = getLocalCache(table);
        const updated = list.map(item => 
          item.representativeId === sourceUid 
            ? { ...item, representativeId: targetUser.uid, representativeName: targetUser.name } 
            : item
        );
        saveToLocalCache(table, updated);
      });

      // Update loans
      const loans = getLocalCache('loans');
      const updatedLoans = loans.map(item => 
        item.employeeId === sourceUid 
          ? { ...item, employeeId: targetUser.uid, employeeName: targetUser.name } 
          : item
      );
      saveToLocalCache('loans', updatedLoans);

      // Update attendance
      const attendance = getLocalCache('attendance');
      const updatedAttendance = attendance.map(item => 
        item.employeeId === sourceUid 
          ? { ...item, employeeId: targetUser.uid, employeeName: targetUser.name } 
          : item
      );
      saveToLocalCache('attendance', updatedAttendance);

      // Update routes
      const routes = getLocalCache('routes');
      const updatedRoutes = routes.map(item => 
        item.representativeId === sourceUid 
          ? { ...item, representativeId: targetUser.uid } 
          : item
      );
      saveToLocalCache('routes', updatedRoutes);

      // Try database sync
      await supabase
        .from('customers')
        .update({ representativeId: targetUser.uid, representativeName: targetUser.name })
        .eq('representativeId', sourceUid);

      await supabase
        .from('invoices')
        .update({ representativeId: targetUser.uid, representativeName: targetUser.name })
        .eq('representativeId', sourceUid);

      await supabase
        .from('settlements')
        .update({ representativeId: targetUser.uid, representativeName: targetUser.name })
        .eq('representativeId', sourceUid);

      await supabase
        .from('loans')
        .update({ employeeId: targetUser.uid, employeeName: targetUser.name })
        .eq('employeeId', sourceUid);

      await supabase
        .from('attendance')
        .update({ employeeId: targetUser.uid, employeeName: targetUser.name })
        .eq('employeeId', sourceUid);

      await supabase
        .from('routes')
        .update({ representativeId: targetUser.uid })
        .eq('representativeId', sourceUid);
    } catch (error) {
      console.error('Error transferring representative data:', error);
    }
  },

  // Transfer single day's sales and transactions
  transferRepresentativeInvoicesForDay: async (sourceUid: string, targetUser: { uid: string, name: string }, date: string) => {
    try {
      // Local updates first
      const tablesToUpdate = ['invoices', 'settlements', 'car_loadings', 'car_returns'];
      tablesToUpdate.forEach(table => {
        const list = getLocalCache(table);
        const updated = list.map(item => 
          (item.representativeId === sourceUid && item.date === date)
            ? { ...item, representativeId: targetUser.uid, representativeName: targetUser.name } 
            : item
        );
        saveToLocalCache(table, updated);
      });

      // Try database sync
      await supabase
        .from('invoices')
        .update({ representativeId: targetUser.uid, representativeName: targetUser.name })
        .eq('representativeId', sourceUid)
        .eq('date', date);

      await supabase
        .from('settlements')
        .update({ representativeId: targetUser.uid, representativeName: targetUser.name })
        .eq('representativeId', sourceUid)
        .eq('date', date);

      await supabase
        .from('car_loadings')
        .update({ representativeId: targetUser.uid, representativeName: targetUser.name })
        .eq('representativeId', sourceUid)
        .eq('date', date);

      await supabase
        .from('car_returns')
        .update({ representativeId: targetUser.uid, representativeName: targetUser.name })
        .eq('representativeId', sourceUid)
        .eq('date', date);
    } catch (error) {
      console.error('Error transferring daily transactions:', error);
      throw error;
    }
  },

  // Generic Getters for compatibility
  getDoc: async (table: string, id: string) => {
    const keyColumn = table === 'users' ? 'uid' : 'id';
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(keyColumn, id)
        .single();
      if (error) throw error;
      
      if (data) {
        updateLocalCacheItem(table, id, data);
      }
      return data;
    } catch (error: any) {
      if (error?.code !== 'PGRST116') {
        console.warn(`Error in getDoc ${table}/${id}:`, error?.message || error);
      }
      const cached = getLocalCache(table);
      return cached.find(x => x[keyColumn] === id || x.id === id) || null;
    }
  },

  getDocs: async (table: string, filters: { field: string, operator: any, value: any }[] = []) => {
    try {
      let query = supabase.from(table).select('*');
      for (const filter of filters) {
        if (filter.operator === '==') {
          query = query.eq(filter.field, filter.value);
        } else if (filter.operator === '>=') {
          query = query.gte(filter.field, filter.value);
        } else if (filter.operator === '<=') {
          query = query.lte(filter.field, filter.value);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      
      const freshData = data || [];
      if (freshData.length > 0) {
        const fullCached = getLocalCache(table);
        const updatedFullCached = [...fullCached];
        const key = table === 'users' ? 'uid' : 'id';
        freshData.forEach((item: any) => {
          const idx = updatedFullCached.findIndex(x => x[key] === item[key] || x.id === item.id);
          if (idx !== -1) {
            updatedFullCached[idx] = { ...updatedFullCached[idx], ...item };
          } else {
            updatedFullCached.push(item);
          }
        });
        saveToLocalCache(table, updatedFullCached);
      }
      return freshData;
    } catch (error: any) {
      console.warn(`Error in getDocs ${table}, using offline cache fallback:`, error?.message || error);
      const cached = getLocalCache(table);
      return cached.filter(item => {
        return filters.every(filter => {
          if (filter.operator === '==') {
            return item[filter.field] === filter.value;
          } else if (filter.operator === '>=') {
            return item[filter.field] >= filter.value;
          } else if (filter.operator === '<=') {
            return item[filter.field] <= filter.value;
          }
          return true;
        });
      });
    }
  }
};
