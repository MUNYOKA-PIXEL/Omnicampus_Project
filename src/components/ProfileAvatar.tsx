import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileAvatarProps {
  avatarPath: string | null | undefined;
  fullName: string | null | undefined;
  className: string;
  imageOverride?: string | null;
}

const ProfileAvatar = ({ avatarPath, fullName, className, imageOverride }: ProfileAvatarProps) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const resolveAvatar = async () => {
      setImageFailed(false);
      if (!avatarPath || imageOverride) {
        setResolvedUrl(null);
        return;
      }
      if (avatarPath.startsWith("http")) {
        setResolvedUrl(avatarPath);
        return;
      }

      const { data, error } = await supabase.storage
        .from("profile-avatars")
        .createSignedUrl(avatarPath, 3600);
      if (error) {
        console.error("Unable to load profile photo:", error);
        if (active) setResolvedUrl(null);
        return;
      }
      if (active) setResolvedUrl(data.signedUrl);
    };

    void resolveAvatar();
    return () => {
      active = false;
    };
  }, [avatarPath, imageOverride]);

  const initials = (fullName || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const imageUrl = imageOverride || resolvedUrl;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={`${fullName || "User"} profile`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
};

export default ProfileAvatar;
