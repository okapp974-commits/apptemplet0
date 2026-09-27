import { supabase } from '../supabase';

export interface AuthUser {
  uid: string;
  email: string | null;
  sessionPassword?: string;
}

let authCallback: ((user: AuthUser | null) => void) | null = null;

export const authService = {
  onAuthStateChanged: (callback: (user: AuthUser | null) => void) => {
    authCallback = callback;
    
    // Check initial session
    const savedUser = localStorage.getItem('ok_app_db_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        callback(u);
      } catch (e) {
        callback(null);
      }
    } else {
      callback(null);
    }

    return () => {
      authCallback = null;
    };
  },

  signIn: async (email: string, password: string) => {
    const lowerEmail = (email || '').toLowerCase().trim();
    const cleanPassword = (password || '').trim();
    console.log('authService.signIn running for:', lowerEmail);

    if (!lowerEmail) {
      throw new Error('يرجى إدخال البريد الإلكتروني.');
    }
    if (!cleanPassword) {
      throw new Error('يرجى إدخال كلمة المرور.');
    }

    // 1. Query database for user record by email
    let matchedUser: any = null;
    let dbUserFound = false;

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', lowerEmail);

      if (!error && users && users.length > 0) {
        dbUserFound = true;
        const targetUser = users[0];
        
        // Strict password check against the password stored in the database
        const dbPassword = String(targetUser.password || '').trim();
        if (dbPassword === cleanPassword || targetUser.password === password) {
          matchedUser = targetUser;
        } else {
          // Password in database does not match the entered password
          throw new Error('بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.');
        }
      }
    } catch (err: any) {
      if (err?.message && err.message.includes('بيانات الدخول غير صحيحة')) {
        throw err;
      }
      console.warn('Database query warning in authService.signIn:', err);
    }

    // 2. Fallback to Local Offline Cache ONLY if remote database query failed / was offline and user was not found
    if (!matchedUser && !dbUserFound) {
      try {
        const rawCached = localStorage.getItem('offline_fallback_users');
        if (rawCached) {
          const cachedUsers = JSON.parse(rawCached);
          if (Array.isArray(cachedUsers)) {
            const foundCached = cachedUsers.find((u: any) => 
              u.email && u.email.toLowerCase().trim() === lowerEmail
            );
            if (foundCached) {
              const cachedPassword = String(foundCached.password || '').trim();
              if (cachedPassword === cleanPassword || foundCached.password === password) {
                matchedUser = foundCached;
              } else {
                throw new Error('بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.');
              }
            }
          }
        }
      } catch (cacheErr: any) {
        if (cacheErr?.message && cacheErr.message.includes('بيانات الدخول غير صحيحة')) {
          throw cacheErr;
        }
        console.warn('Cache lookup error in authService:', cacheErr);
      }
    }

    // 3. Auto-bootstrap Initial Master Accounts ONLY if they do not exist in the database AT ALL (initial fresh install)
    if (!matchedUser && !dbUserFound) {
      const isDeveloper = (lowerEmail === 'okapp974@gmail.com' || lowerEmail === 'okkapp974@gmail.com') && cleanPassword === 'Moh@123@';
      const isManager = (lowerEmail === 'admin@ok.com' || lowerEmail === 'amin@ok.com') && cleanPassword === '123456789';
      const isAccountant = lowerEmail === 'mohsen@ok.com' && cleanPassword === '123456789';

      if (isDeveloper) {
        const uid = 'developer-uid-default';
        const profileData = {
          uid,
          id: uid,
          name: 'المطور الرئيسي',
          email: lowerEmail,
          password: cleanPassword,
          role: 'developer',
          baseSalary: 0,
          salaryType: 'monthly',
          targetBonus: 0,
          status: 'active',
          updated_at: new Date().toISOString()
        };
        try {
          await supabase.from('users').upsert(profileData);
        } catch (e) {
          console.warn('Failed to upsert master developer to db:', e);
        }
        matchedUser = profileData;
      } else if (isManager) {
        const uid = lowerEmail.startsWith('amin') ? 'amin-uid-default' : 'admin-uid-default';
        const profileData = {
          uid,
          id: uid,
          name: lowerEmail.startsWith('amin') ? 'أمين - الإدارة' : 'المدير العام (الرئيسي)',
          email: lowerEmail,
          password: cleanPassword,
          role: 'manager',
          baseSalary: 0,
          salaryType: 'monthly',
          targetBonus: 0,
          status: 'active',
          updated_at: new Date().toISOString()
        };
        try {
          await supabase.from('users').upsert(profileData);
        } catch (e) {
          console.warn('Failed to upsert master manager to db:', e);
        }
        matchedUser = profileData;
      } else if (isAccountant) {
        const uid = 'mohsen-uid-default';
        const profileData = {
          uid,
          id: uid,
          name: 'محسن - المحاسبة',
          email: lowerEmail,
          password: cleanPassword,
          role: 'accountant',
          baseSalary: 0,
          salaryType: 'monthly',
          targetBonus: 0,
          status: 'active',
          updated_at: new Date().toISOString()
        };
        try {
          await supabase.from('users').upsert(profileData);
        } catch (e) {
          console.warn('Failed to upsert accountant to db:', e);
        }
        matchedUser = profileData;
      }
    }

    if (!matchedUser) {
      throw new Error('بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.');
    }

    if (matchedUser.status === 'inactive') {
      throw new Error('هذا الحساب تم تعطيله من قبل الإدارة.');
    }

    const uid = matchedUser.uid || matchedUser.id || 'uid-' + Math.random().toString(36).substring(2, 9);
    const userSession: AuthUser = { uid, email: lowerEmail, sessionPassword: cleanPassword };
    localStorage.setItem('ok_app_db_user', JSON.stringify(userSession));
    if (authCallback) {
      authCallback(userSession);
    }
    return userSession;
  },

  signUp: async (email: string, password: string) => {
    console.log('authService.signUp starting for database-only user:', email);
    const randomUid = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : '00000000-0000-4000-a000-' + Math.random().toString(16).slice(2, 14);
    return {
      uid: randomUid,
      email: email.toLowerCase().trim()
    };
  },

  signUpSecondary: async (email: string, password: string) => {
    console.log('authService.signUpSecondary starting for database-only user:', email);
    const randomUid = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : '00000000-0000-4000-a000-' + Math.random().toString(16).slice(2, 14);
    return {
      uid: randomUid,
      email: email.toLowerCase().trim()
    };
  },

  deleteUser: async (email?: string, password?: string) => {
    console.log('deleteUser request for:', email);
    // Bypassed for database-only login
  },

  signOut: async () => {
    localStorage.removeItem('ok_app_db_user');
    if (authCallback) {
      authCallback(null);
    }
  },

  resetPassword: async (email: string) => {
    console.log('Password reset requested (database-only authentication) for:', email);
    // Return a dummy resolved promise as there's no auth server
    return Promise.resolve();
  }
};
