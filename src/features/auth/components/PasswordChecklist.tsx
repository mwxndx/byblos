import React from 'react';
import { Check } from '@/shared/ui/icons';

export interface PasswordChecklistProps {
  password?: string;
  confirmPassword?: string;
  title?: string;
  showMatch?: boolean;
  className?: string;
}

export function PasswordChecklist({
  password = '',
  confirmPassword,
  title = 'Password Requirements',
  showMatch = true,
  className = '',
}: PasswordChecklistProps) {
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = confirmPassword !== undefined && confirmPassword.length > 0 && password === confirmPassword;

  const items = [
    { label: '8+ characters', satisfied: hasMinLength },
    { label: '1 number', satisfied: hasNumber },
    { label: 'Upper & lowercase letters', satisfied: hasUpperLower },
    { label: '1 special character', satisfied: hasSpecial },
  ];

  if (showMatch && confirmPassword !== undefined) {
    items.push({ label: 'Passwords match', satisfied: Boolean(passwordsMatch) });
  }

  return (
    <div className={`w-full bg-[#27272c] border border-[#34343a] rounded-[14.5px] p-4 flex flex-col gap-2.5 ${className}`}>
      <span className="text-[11px] font-bold tracking-wider text-[#636366] uppercase">
        {title}
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[13px]">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                item.satisfied
                  ? 'bg-[#30d158] border-[#30d158] text-black'
                  : 'bg-transparent border-[#636366]'
              }`}
            >
              {item.satisfied && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </span>
            <span className={item.satisfied ? 'text-[#30d158]' : 'text-[#a1a1a6]'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
