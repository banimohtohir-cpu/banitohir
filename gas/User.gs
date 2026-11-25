/**
 * User.gs
 * Manajemen akun pengguna, role, status aktif/nonaktif, dan penelusuran audit log.
 */

function listUsersSafe(sessionToken) {
  requireAuth(sessionToken, 'USERS', 'view');
  var users = readSheetObjects(SHEET_NAMES.USERS, false);
  return users.map(projectSafeUser_);
}

function createUserAccount(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'USERS', 'create');
    var uname = sanitizeString(payload.username_login).toLowerCase();
    var display = sanitizeString(payload.nama_tampilan);
    var roleId = sanitizeString(payload.role_id) || 'ANGGOTA';
    var idAnggota = sanitizeString(payload.id_anggota);
    var plainPwd = String(payload.password || '');

    if (!uname || uname.length < 4) throw new Error('ID Login minimal 4 karakter.');
    if (!display) throw new Error('Nama tampilan wajib diisi.');
    if (plainPwd.length < 8) throw new Error('Password minimal 8 karakter.');

    var validRoles = ['SUPER_ADMIN', 'ADMIN_KELUARGA', 'PENGURUS', 'BENDAHARA', 'SEKRETARIS', 'ANGGOTA'];
    if (validRoles.indexOf(roleId) === -1) throw new Error('Role tidak dikenal.');

    var users = readSheetObjects(SHEET_NAMES.USERS, false);
    var exists = users.some(function (u) {
      return String(u.username_login).toLowerCase() === uname;
    });
    if (exists) throw new Error('ID Login "' + uname + '" sudah digunakan.');

    var nextSeq = users.length + 1;
    var userId = 'USR-' + ('0000' + nextSeq).slice(-4);
    var salt = generateSalt(24);
    var hash = hashPasswordWithSalt(plainPwd, salt);
    var now = nowJakartaIso();

    var newUser = {
      user_id: userId,
      id_anggota: idAnggota,
      username_login: uname,
      nama_tampilan: display,
      password_hash: hash,
      salt: salt,
      role_id: roleId,
      status_akun: 'AKTIF',
      failed_attempts: 0,
      locked_until: '',
      last_login: '',
      must_change_pwd: true,
      created_at: now,
      updated_at: now
    };

    appendObjectRows(SHEET_NAMES.USERS, [newUser]);
    writeAuditLog(actor, 'TAMBAH_USER', 'USERS', userId, null, { username: uname, role_id: roleId }, 'BERHASIL', 'Pembuatan akun pengguna baru');

    return { ok: true, user: projectSafeUser_(newUser) };
  });
}

function updateUserRoleOrStatus(sessionToken, targetUserId, newRoleId, newStatus) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'USERS', 'edit');
    var users = readSheetObjects(SHEET_NAMES.USERS, false);
    var target = null;
    var activeSuperAdmins = 0;

    users.forEach(function (u) {
      if (u.user_id === targetUserId) target = u;
      if (u.role_id === 'SUPER_ADMIN' && String(u.status_akun).toUpperCase() === 'AKTIF') {
        activeSuperAdmins++;
      }
    });

    if (!target) throw new Error('Akun pengguna tidak ditemukan.');

    var finalRole = newRoleId ? sanitizeString(newRoleId) : target.role_id;
    var finalStatus = newStatus ? sanitizeString(newStatus).toUpperCase() : target.status_akun;

    // Cegah menonaktifkan/menurunkan satu-satunya SUPER_ADMIN aktif
    if (target.role_id === 'SUPER_ADMIN' && String(target.status_akun).toUpperCase() === 'AKTIF') {
      if ((finalRole !== 'SUPER_ADMIN' || finalStatus !== 'AKTIF') && activeSuperAdmins <= 1) {
        throw new Error('Minimal harus ada 1 akun SUPER ADMIN aktif.');
      }
    }

    var patch = {
      role_id: finalRole,
      status_akun: finalStatus,
      updated_at: nowJakartaIso()
    };
    updateRowByPrimaryKey(SHEET_NAMES.USERS, 'user_id', targetUserId, patch);

    writeAuditLog(
      actor,
      'UBAH_USER_ROLE_STATUS',
      'USERS',
      targetUserId,
      { role_id: target.role_id, status_akun: target.status_akun },
      { role_id: finalRole, status_akun: finalStatus },
      'BERHASIL',
      'Perubahan role/status akun'
    );

    return { ok: true, message: 'Data akun berhasil diperbarui.' };
  });
}

function listRolePermissions(sessionToken) {
  requireAuth(sessionToken, 'USERS', 'view');
  return readSheetObjects(SHEET_NAMES.ROLES_PERMISSIONS, true);
}

function getAuditLogs(sessionToken, limit, search) {
  requireAuth(sessionToken, 'AUDIT_LOG', 'view');
  var rows = readSheetObjects(SHEET_NAMES.AUDIT_LOG, false);
  var q = sanitizeString(search).toLowerCase();
  if (q) {
    rows = rows.filter(function (r) {
      return String(r.username + ' ' + r.aksi + ' ' + r.entitas + ' ' + r.catatan).toLowerCase().indexOf(q) > -1;
    });
  }
  rows.reverse();
  var maxRows = Math.min(parseInt(limit, 10) || 100, 500);
  return rows.slice(0, maxRows);
}
