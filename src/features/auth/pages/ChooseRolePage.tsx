import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PenpotAuthLayout } from '@/features/auth/components/PenpotAuthLayout';

export function ChooseRolePage() {
  const navigate = useNavigate();

  const roles = [
    {
      title: 'I want to shop',
      description: 'Browse brands and pay with M-Pesa. Your money is held until your order arrives.',
      path: '/buyer/login',
      tag: 'Buyer',
    },
    {
      title: 'I sell on Instagram or TikTok',
      description: 'Get your shop link, manage orders and get paid after delivery.',
      path: '/seller/login',
      tag: 'Seller',
    },
    {
      title: 'I’m a creator',
      description: 'Earn commission by promoting brands you believe in.',
      path: '/creator/login',
      tag: 'Creator',
    },
  ];

  return (
    <PenpotAuthLayout
      title="Welcome to Byblos"
      subtitle="Shop and sell safely. Choose how you’ll use Byblos."
      showTrustLine={true}
    >
      <div className="flex flex-col gap-3.5 w-full">
        {roles.map((role, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => navigate(role.path)}
            className="w-full text-left bg-[#27272c] hover:bg-[#2d2d34] border border-[#34343a] hover:border-[#f5c518] rounded-[14.5px] p-5 transition-all duration-200 flex items-center justify-between group active:scale-[0.99]"
          >
            <div className="flex flex-col gap-1 pr-3">
              <h2 className="text-[16px] font-semibold text-white group-hover:text-[#f5c518] transition-colors">
                {role.title}
              </h2>
              <p className="text-[13px] text-[#a1a1a6] leading-relaxed">
                {role.description}
              </p>
            </div>
            <span className="text-xl text-[#a1a1a6] group-hover:text-[#f5c518] group-hover:translate-x-1 transition-all">
              →
            </span>
          </button>
        ))}
      </div>
    </PenpotAuthLayout>
  );
}

export default ChooseRolePage;

