import { Check as CheckIcon } from 'lucide-react';

interface CheckProps {
  on: boolean;
  onClick: () => void;
  label?: string;
}

export function Check({ on, onClick, label }: CheckProps) {
  return (
    <div className={`check ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="box">
        {on && <CheckIcon size={9} strokeWidth={3} />}
      </span>
      {label}
    </div>
  );
}
