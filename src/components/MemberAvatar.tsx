import React, { useEffect, useState } from 'react';
import { getMemberInitials, resolveMemberPhotoUrl } from '../utils/memberPhoto';

interface MemberAvatarProps {
  name?: string;
  photoValue?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MemberAvatar({ name, photoValue, size = 'md', className = '' }: MemberAvatarProps) {
  const resolved = resolveMemberPhotoUrl(photoValue);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);

  const sizeClasses =
    size === 'lg'
      ? 'w-16 h-16 text-base rounded-xl'
      : size === 'md'
      ? 'w-14 h-14 text-sm rounded-xl'
      : 'w-10 h-10 text-xs rounded-lg';

  const initials = getMemberInitials(name);

  if (resolved && !imgFailed) {
    return (
      <div
        className={`${sizeClasses} shrink-0 overflow-hidden border border-neutral-200 bg-neutral-100 ${className}`}
      >
        <img
          src={resolved}
          alt={name ? `Foto ${name}` : 'Foto anggota'}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-label={name ? `Inisial ${name}` : 'Foto belum tersedia'}
      className={`${sizeClasses} shrink-0 flex items-center justify-center border border-green-200 bg-green-50 text-green-800 font-bold select-none ${className}`}
    >
      {initials}
    </div>
  );
}
