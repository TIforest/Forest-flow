import { useState } from 'react';
import type { User } from './types';
export function AvatarPhoto({
  user,
  fallback,
}: {
  user?: Pick<User, 'microsoft_photo'>;
  fallback: string;
}) {
  const [failed, setFailed] = useState('');
  const photo = user?.microsoft_photo;
  return photo && photo !== failed ? (
    <img
      className="microsoft-avatar-photo"
      src={photo}
      alt=""
      onError={() => setFailed(photo)}
    />
  ) : (
    <>{fallback}</>
  );
}
