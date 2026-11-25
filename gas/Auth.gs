/**
 * Auth.gs
 * Autentikasi server-side dengan hash HMAC-SHA256 + salt per user,
 * pembatasan percobaan login (rate limit), sesi token server, dan RBAC.
 */

function getOrInitAuthPepper() {
  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_SERVER_PEPPER');
  if (!pepper) {
    pepper = Utilities.getUuid() + '-' + Utilities.getUuid();
    props.setProperty('AUTH_SERVER_PEPPER', pepper);
  }
  return pepper;
}

function generateSalt(length) {
  var raw = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  return raw.substring(0, length || 24);
}

function hashPasswordWithSalt(plainPassword, salt) {
  var pepper = getOrInitAuthPepper();
  var input = String(salt) + ':' + String(plainPassword);
  var bytes = Utilities.computeHmacSha256Signature(input, pepper);
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function constantTimeEqual(a, b) {
  var s1 = String(a || '');
  var s2 = String(b || '');
  if (s1.length !== s2.length) return false;
  var diff = 0;
  for (var i = 0; i < s1.length; i++) {
    diff |= s1.charCodeAt(i) ^ s2.charCodeAt(i);
  }
  return diff === 0;
}

function isBootstrapRequired() {
  var ss = getDb();
  var usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (!usersSheet || usersSheet.getLastRow() <= 1) return true;
  var users = readSheetObjects(SHEET_NAMES.USERS, false);
  return !users.some(function (u) {
    return u.role_id === 'SUPER_ADMIN' && String(u.status_akun).toUpperCase() === 'AKTIF';
  });
}

function setupInitialSuperAdmin(username, namaTampilan, password) {
  return withScriptLock(function () {
    initializeDatabase({ user_id: 'BOOTSTRAP', username_login: 'BOOTSTRAP', role_id: 'SUPER_ADMIN' });

    if (!isBootstrapRequired()) {
      throw new Error('Akun Super Admin sudah terdaftar. Gunakan halaman login.');
    }

    var uname = sanitizeString(username).toLowerCase();
    var display = sanitizeString(namaTampilan) || 'Super Admin Bani Tohir';
    if (!uname || uname.length < 4) {
      throw new Error('ID Login minimal 4 karakter.');
    }
    if (!password || String(password).length < 8) {
      throw new Error('Password minimal 8 karakter.');
    }

    var salt = generateSalt(24);
    var hash = hashPasswordWithSalt(password, salt);
    var now = nowJakartaIso();
    var userObj = {
      user_id: 'USR-0001',
      id_anggota: '',
      username_login: uname,
      nama_tampilan: display,
      password_hash: hash,
      salt: salt,
      role_id: 'SUPER_ADMIN',
      status_akun: 'AKTIF',
      failed_attempts: 0,
      locked_until: '',
      last_login: now,
      must_change_pwd: false,
      created_at: now,
      updated_at: now
    };

    appendObjectRows(SHEET_NAMES.USERS, [userObj]);
    var token = createSessionToken_(userObj);

    writeAuditLog(userObj, 'BOOTSTRAP_ADMIN', 'USERS', userObj.user_id, null, { username: uname }, 'BERHASIL', 'Klaim akun Super Admin pertama');

    return {
      ok: true,
      sessionToken: token,
      user: projectSafeUser_(userObj),
      permissions: getPermissionsForRole_(userObj.role_id)
    };
  });
}

function loginUser(username, password) {
  return withScriptLock(function () {
    var uname = sanitizeString(username).toLowerCase();
    if (!uname || !password) {
      throw new Error('ID Login dan password wajib diisi.');
    }

    var users = readSheetObjects(SHEET_NAMES.USERS, false);
    var target = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].username_login).toLowerCase() === uname) {
        target = users[i];
        break;
      }
    }

    if (!target) {
      writeAuditLog({ username_login: uname, role_id: 'GUEST' }, 'LOGIN_GAGAL', 'AUTH', uname, null, null, 'DITOLAK', 'ID Login tidak ditemukan');
      throw new Error('ID Login atau password tidak sesuai.');
    }

    if (String(target.status_akun).toUpperCase() !== 'AKTIF') {
      writeAuditLog(target, 'LOGIN_NONAKTIF', 'AUTH', target.user_id, null, null, 'DITOLAK', 'Akun nonaktif');
      throw new Error('Akun Anda sedang dinonaktifkan. Hubungi Admin Paguyuban.');
    }

    // Cek lockout
    if (target.locked_until) {
      var lockTime = new Date(target.locked_until).getTime();
      if (!isNaN(lockTime) && Date.now() < lockTime) {
        var sisaMenit = Math.ceil((lockTime - Date.now()) / 60000);
        throw new Error('Akun terkunci sementara karena batas percobaan login. Coba lagi dalam ' + sisaMenit + ' menit.');
      }
    }

    var computed = hashPasswordWithSalt(password, target.salt);
    if (!constantTimeEqual(computed, target.password_hash)) {
      var fails = (parseInt(target.failed_attempts, 10) || 0) + 1;
      var patch = { failed_attempts: fails, updated_at: nowJakartaIso() };
      if (fails >= APP_CONFIG.MAX_LOGIN_ATTEMPTS) {
        var until = new Date(Date.now() + APP_CONFIG.LOCKOUT_MINUTES * 60000);
        patch.locked_until = Utilities.formatDate(until, APP_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
      }
      updateRowByPrimaryKey(SHEET_NAMES.USERS, 'user_id', target.user_id, patch);
      writeAuditLog(target, 'LOGIN_GAGAL', 'AUTH', target.user_id, null, { failed_attempts: fails }, 'GAGAL', 'Password salah');
      throw new Error('ID Login atau password tidak sesuai.');
    }

    var now = nowJakartaIso();
    updateRowByPrimaryKey(SHEET_NAMES.USERS, 'user_id', target.user_id, {
      failed_attempts: 0,
      locked_until: '',
      last_login: now,
      updated_at: now
    });
    target.last_login = now;

    var token = createSessionToken_(target);
    writeAuditLog(target, 'LOGIN', 'AUTH', target.user_id, null, null, 'BERHASIL', 'Login sukses');

    return {
      ok: true,
      sessionToken: token,
      user: projectSafeUser_(target),
      permissions: getPermissionsForRole_(target.role_id)
    };
  });
}

function logoutUser(sessionToken) {
  if (!sessionToken) return { ok: true };
  var user = getSessionUser(sessionToken);
  CacheService.getScriptCache().remove('SESS_' + sessionToken);
  if (user) {
    writeAuditLog(user, 'LOGOUT', 'AUTH', user.user_id, null, null, 'BERHASIL', 'Logout pengguna');
  }
  return { ok: true };
}

function createSessionToken_(userObj) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var sessionPayload = {
    user_id: userObj.user_id,
    id_anggota: userObj.id_anggota || '',
    username_login: userObj.username_login,
    nama_tampilan: userObj.nama_tampilan,
    role_id: userObj.role_id,
    created_ms: Date.now()
  };
  CacheService.getScriptCache().put('SESS_' + token, JSON.stringify(sessionPayload), APP_CONFIG.SESSION_TTL_SECONDS);
  return token;
}

function getSessionUser(sessionToken) {
  if (!sessionToken) return null;
  var raw = CacheService.getScriptCache().get('SESS_' + sessionToken);
  if (!raw) return null;
  try {
    var sess = JSON.parse(raw);
    // Perpanjang sliding TTL sesi
    CacheService.getScriptCache().put('SESS_' + sessionToken, raw, APP_CONFIG.SESSION_TTL_SECONDS);
    return sess;
  } catch (e) {
    return null;
  }
}

/**
 * Verifikasi autentikasi dan izin modul secara ketat di server.
 * action: 'view' | 'create' | 'edit' | 'delete' | 'export' | 'sensitive' | 'finance'
 */
function requireAuth(sessionToken, moduleName, action) {
  var sess = getSessionUser(sessionToken);
  if (!sess) {
    throw new Error('Sesi berakhir atau tidak valid. Silakan login kembali.');
  }

  // Pastikan user masih aktif di database
  var users = readSheetObjects(SHEET_NAMES.USERS, true);
  var dbUser = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].user_id === sess.user_id) {
      dbUser = users[i];
      break;
    }
  }
  if (!dbUser || String(dbUser.status_akun).toUpperCase() !== 'AKTIF') {
    throw new Error('Akun pengguna tidak aktif.');
  }

  if (moduleName) {
    var perms = getPermissionsForRole_(dbUser.role_id);
    var modPerm = perms[moduleName];
    var actionKeyMap = {
      view: 'can_view',
      create: 'can_create',
      edit: 'can_edit',
      delete: 'can_delete',
      export: 'can_export',
      sensitive: 'view_sensitive_contact',
      finance: 'view_finance_detail'
    };
    var col = actionKeyMap[action || 'view'];
    if (!modPerm || !modPerm[col]) {
      writeAuditLog(dbUser, 'AKSES_DITOLAK', moduleName, '', null, { action: action }, 'DITOLAK', 'Hak akses tidak mencukupi');
      throw new Error('Anda tidak memiliki izin untuk mengakses aksi ini pada modul ' + moduleName + '.');
    }
  }

  return projectSafeUser_(dbUser);
}

function getPermissionsForRole_(roleId) {
  var rows = readSheetObjects(SHEET_NAMES.ROLES_PERMISSIONS, true);
  var map = {};
  rows.forEach(function (r) {
    if (r.role_id === roleId) {
      map[r.modul] = {
        can_view: r.can_view === true || String(r.can_view).toUpperCase() === 'TRUE',
        can_create: r.can_create === true || String(r.can_create).toUpperCase() === 'TRUE',
        can_edit: r.can_edit === true || String(r.can_edit).toUpperCase() === 'TRUE',
        can_delete: r.can_delete === true || String(r.can_delete).toUpperCase() === 'TRUE',
        can_export: r.can_export === true || String(r.can_export).toUpperCase() === 'TRUE',
        view_sensitive_contact: r.view_sensitive_contact === true || String(r.view_sensitive_contact).toUpperCase() === 'TRUE',
        view_finance_detail: r.view_finance_detail === true || String(r.view_finance_detail).toUpperCase() === 'TRUE'
      };
    }
  });
  return map;
}

function projectSafeUser_(u) {
  return {
    user_id: u.user_id,
    id_anggota: u.id_anggota || '',
    username_login: u.username_login,
    nama_tampilan: u.nama_tampilan,
    role_id: u.role_id,
    status_akun: u.status_akun,
    last_login: u.last_login || '',
    must_change_pwd: u.must_change_pwd === true || String(u.must_change_pwd).toUpperCase() === 'TRUE'
  };
}

function changeOwnPassword(sessionToken, oldPassword, newPassword) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken);
    if (!newPassword || String(newPassword).length < 8) {
      throw new Error('Password baru minimal 8 karakter.');
    }

    var users = readSheetObjects(SHEET_NAMES.USERS, false);
    var current = users.filter(function (u) { return u.user_id === actor.user_id; })[0];
    if (!current) throw new Error('Pengguna tidak ditemukan.');

    var oldComputed = hashPasswordWithSalt(oldPassword, current.salt);
    if (!constantTimeEqual(oldComputed, current.password_hash)) {
      throw new Error('Password lama tidak sesuai.');
    }

    var newSalt = generateSalt(24);
    var newHash = hashPasswordWithSalt(newPassword, newSalt);
    updateRowByPrimaryKey(SHEET_NAMES.USERS, 'user_id', actor.user_id, {
      password_hash: newHash,
      salt: newSalt,
      must_change_pwd: false,
      updated_at: nowJakartaIso()
    });

    writeAuditLog(actor, 'GANTI_PASSWORD', 'USERS', actor.user_id, null, null, 'BERHASIL', 'Pengguna mengganti password sendiri');
    return { ok: true, message: 'Password berhasil diperbarui.' };
  });
}

function resetPasswordByAdmin(sessionToken, targetUserId, tempPassword) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'USERS', 'edit');
    if (!tempPassword || String(tempPassword).length < 8) {
      throw new Error('Password sementara minimal 8 karakter.');
    }
    var newSalt = generateSalt(24);
    var newHash = hashPasswordWithSalt(tempPassword, newSalt);
    var updated = updateRowByPrimaryKey(SHEET_NAMES.USERS, 'user_id', targetUserId, {
      password_hash: newHash,
      salt: newSalt,
      failed_attempts: 0,
      locked_until: '',
      must_change_pwd: true,
      updated_at: nowJakartaIso()
    });
    if (!updated) throw new Error('Akun target tidak ditemukan.');

    writeAuditLog(actor, 'RESET_PASSWORD_ADMIN', 'USERS', targetUserId, null, { must_change_pwd: true }, 'BERHASIL', 'Reset password oleh admin');
    return { ok: true, message: 'Password akun berhasil direset. Pengguna wajib mengganti password saat login berikutnya.' };
  });
}
