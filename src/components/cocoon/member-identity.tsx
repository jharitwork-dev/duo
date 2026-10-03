import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from 'cn';

export interface MemberDisplay {
  name: string;
  email: string | null;
  imageUrl: string | null;
}

export function initialOf(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

export function MemberAvatar({ name, imageUrl, className }: Pick<MemberDisplay, 'name' | 'imageUrl'> & { className?: string }) {
  return (
    <Avatar className={cn('size-9', className)}>
      {imageUrl && <AvatarImage src={imageUrl} alt="" />}
      <AvatarFallback className="bg-cocoon-cream text-xs font-bold text-cocoon-blue">{initialOf(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Avatar + name + email, used in teacher/admin member lists instead of raw Clerk ids. */
export function MemberIdentity({ name, email, imageUrl }: MemberDisplay) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar name={name} imageUrl={imageUrl} />
      <div className="min-w-0">
        <p className="truncate text-[14px] leading-normal font-bold text-cocoon-ink">{name}</p>
        {email && <p className="truncate text-[12px] leading-normal font-medium text-cocoon-muted">{email}</p>}
      </div>
    </div>
  );
}
