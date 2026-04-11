import Image from 'next/image';

interface BoneIconProps {
  size?: number;
  className?: string;
}

export default function BoneIcon({ size = 14, className = '' }: BoneIconProps) {
  return (
    <Image
      src="/images/ui/bone.png"
      alt="뼈다귀"
      width={size}
      height={size}
      className={`inline-block align-text-bottom ${className}`}
    />
  );
}
