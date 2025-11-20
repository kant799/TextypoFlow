import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  size = 'md',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 shadow",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80",
    ghost: "hover:bg-zinc-100 hover:text-zinc-900",
    outline: "border border-zinc-200 bg-transparent hover:bg-zinc-100 text-zinc-900",
    destructive: "bg-red-500 text-zinc-50 hover:bg-red-500/90 shadow-sm",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 py-2",
    lg: "h-10 px-8",
    icon: "h-9 w-9",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};
