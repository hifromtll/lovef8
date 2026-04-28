'use client';

type ComposerAvatarProps = {
  avatarUrl?: string | null;
  label?: string | null;
};

export default function ComposerAvatar({
  avatarUrl,
  label,
}: ComposerAvatarProps) {
  const initials =
    (label || '?')
      .trim()
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  return (
    <div className="flex shrink-0 items-end">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={label || 'Profile'}
          className="h-11 w-11 rounded-full border border-zinc-300 object-cover shadow-sm"
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 bg-zinc-200 text-sm font-semibold text-zinc-700 shadow-sm">
          {initials}
        </div>
      )}
    </div>
  );
}