'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  userId: string;
  currentAvatarUrl: string | null;
  onUploadComplete: (filePath: string, previewUrl: string) => void;
  tr?: (text: string) => string;
};

type PhotoItem = {
  path: string;
  url: string;
  isMain: boolean;
};

const MAX_PHOTOS = 6;
const MIN_PHOTOS_TO_EARN = 3;

function getSafeExtension(fileName: string) {
  const fileExt = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt) ? fileExt : 'jpg';
}

async function createAvatarThumbnail(file: File, size = 96): Promise<Blob> {
  const imageBitmap = await createImageBitmap(file);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context.');
  }

  const srcW = imageBitmap.width;
  const srcH = imageBitmap.height;
  const srcSize = Math.min(srcW, srcH);
  const sx = Math.floor((srcW - srcSize) / 2);
  const sy = Math.floor((srcH - srcSize) / 2);

  ctx.drawImage(
    imageBitmap,
    sx,
    sy,
    srcSize,
    srcSize,
    0,
    0,
    size,
    size
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.82)
  );

  if (!blob) {
    throw new Error('Could not create thumbnail blob.');
  }

  return blob;
}

export default function ProfilePhotoUploader({
  userId,
  currentAvatarUrl,
  onUploadComplete,
  tr = (text: string) => text,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [mainAvatarPath, setMainAvatarPath] = useState<string | null>(null);

  async function getSignedUrl(path: string) {
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .createSignedUrl(path, 60 * 60);

    if (error || !data?.signedUrl) {
      throw error || new Error('Could not create signed URL.');
    }

    return data.signedUrl;
  }

  async function loadMainAvatarPath() {
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const path =
      typeof data?.avatar_url === 'string' && data.avatar_url.trim()
        ? data.avatar_url.trim()
        : null;

    setMainAvatarPath(path);
    return path;
  }

  async function loadPhotos() {
    setLoadingPhotos(true);
    setError(null);

    try {
      const currentMainPath = await loadMainAvatarPath();

      const { data: listed, error: listError } = await supabase.storage
        .from('profile-photos')
        .list(userId, {
          limit: 100,
          sortBy: { column: 'name', order: 'desc' },
        });

      if (listError) throw listError;

      const files = (listed || []).filter((item) => !!item.name);
      const paths = files.map((file) => `${userId}/${file.name}`);

      if (paths.length === 0) {
        setPhotos([]);
        setLoadingPhotos(false);
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('profile-photos')
        .createSignedUrls(paths, 60 * 60);

      if (signedError) throw signedError;

      const mapped: PhotoItem[] = paths
        .map((path, index) => ({
          path,
          url: signedData?.[index]?.signedUrl || '',
          isMain: path === currentMainPath,
        }))
        .filter((item) => !!item.url);

      mapped.sort((a, b) => {
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        return a.path.localeCompare(b.path);
      });

      setPhotos(mapped);
    } catch (err: any) {
      setError(err?.message || 'Could not load profile photos.');
    } finally {
      setLoadingPhotos(false);
    }
  }

  useEffect(() => {
    void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveMainAvatar(filePath: string | null) {
  const thumbPath = filePath ? `${userId}/avatar-thumb.jpg` : null;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      avatar_url: filePath,
      avatar_thumb_url: thumbPath,
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  setMainAvatarPath(filePath);
}

  async function notifyParentWithPath(filePath: string | null) {
    if (!filePath) {
      onUploadComplete('', '');
      return;
    }

    const signedUrl = await getSignedUrl(filePath);
    onUploadComplete(filePath, signedUrl);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      const currentCount = photos.length;
      const remainingSlots = Math.max(0, MAX_PHOTOS - currentCount);

      if (remainingSlots <= 0) {
        throw new Error(`You can upload up to ${MAX_PHOTOS} photos.`);
      }

      const filesToUpload = selectedFiles.slice(0, remainingSlots);
      const uploadedPaths: string[] = [];

            for (let i = 0; i < filesToUpload.length; i += 1) {
        const file = filesToUpload[i];
        const safeExt = getSafeExtension(file.name);
        const filePath = `${userId}/photo-${Date.now()}-${i}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);

        const shouldBecomeMain = !mainAvatarPath && uploadedPaths.length === 1;

        if (shouldBecomeMain) {
          const thumbBlob = await createAvatarThumbnail(file, 96);
          const thumbPath = `${userId}/avatar-thumb.jpg`;

          const { error: thumbUploadError } = await supabase.storage
            .from('profile-photos')
            .upload(thumbPath, thumbBlob, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg',
            });

          if (thumbUploadError) throw thumbUploadError;
        }
      }

      let nextMainPath = mainAvatarPath;

      if (!nextMainPath && uploadedPaths.length > 0) {
        nextMainPath = uploadedPaths[0];
        await saveMainAvatar(nextMainPath);
      }

      await loadPhotos();
      await notifyParentWithPath(nextMainPath);
    } catch (err: any) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleSetMain(photoPath: string) {
  setError(null);
  setBusyPath(photoPath);

  try {
    const fileName = photoPath.split('/').pop();
    if (!fileName) {
      throw new Error('Could not find selected photo.');
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('profile-photos')
      .download(photoPath);

    if (downloadError || !fileData) {
      throw downloadError || new Error('Could not download selected photo.');
    }

    const originalFile = new File([fileData], fileName, {
      type: fileData.type || 'image/jpeg',
    });

    const thumbBlob = await createAvatarThumbnail(originalFile, 96);
    const thumbPath = `${userId}/avatar-thumb.jpg`;

    const { error: thumbUploadError } = await supabase.storage
      .from('profile-photos')
      .upload(thumbPath, thumbBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (thumbUploadError) throw thumbUploadError;

    await saveMainAvatar(photoPath);
    await loadPhotos();
    await notifyParentWithPath(photoPath);
  } catch (err: any) {
    setError(err?.message || 'Could not set main photo.');
  } finally {
    setBusyPath(null);
  }
}
  async function handleDelete(photoPath: string) {
    setError(null);
    setBusyPath(photoPath);

    try {
      const deletingMain = photoPath === mainAvatarPath;
      const remainingPhotos = photos.filter((photo) => photo.path !== photoPath);

      const { error: removeError } = await supabase.storage
        .from('profile-photos')
        .remove([photoPath]);

      if (removeError) throw removeError;

            if (deletingMain) {
        const replacementPath = remainingPhotos[0]?.path || null;

        if (replacementPath) {
          const fileName = replacementPath.split('/').pop();
          if (!fileName) {
            throw new Error('Could not find replacement photo.');
          }

          const { data: fileData, error: downloadError } = await supabase.storage
            .from('profile-photos')
            .download(replacementPath);

          if (downloadError || !fileData) {
            throw downloadError || new Error('Could not download replacement photo.');
          }

          const replacementFile = new File([fileData], fileName, {
            type: fileData.type || 'image/jpeg',
          });

          const thumbBlob = await createAvatarThumbnail(replacementFile, 96);
          const thumbPath = `${userId}/avatar-thumb.jpg`;

          const { error: thumbUploadError } = await supabase.storage
            .from('profile-photos')
            .upload(thumbPath, thumbBlob, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg',
            });

          if (thumbUploadError) throw thumbUploadError;
        } else {
          const { error: thumbRemoveError } = await supabase.storage
            .from('profile-photos')
            .remove([`${userId}/avatar-thumb.jpg`]);

          if (thumbRemoveError) {
            console.error('Could not remove avatar thumb:', thumbRemoveError);
          }
        }

        await saveMainAvatar(replacementPath);
        await loadPhotos();
        await notifyParentWithPath(replacementPath);
      } else {
        await loadPhotos();
        await notifyParentWithPath(mainAvatarPath);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not delete photo.');
    } finally {
      setBusyPath(null);
    }
  }

  const photoCount = photos.length;
  const needsMorePhotos = photoCount < MIN_PHOTOS_TO_EARN;
  const remainingNeeded = Math.max(0, MIN_PHOTOS_TO_EARN - photoCount);
  const mainPhoto = photos.find((photo) => photo.isMain) || null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-bold">{tr('Profile Photos')}</div>
      <div className="mt-2 text-sm leading-6 text-neutral-600">
        {tr(
          'Add multiple photos so your profile feels more real and complete. Hosts need at least 3 photos before they can earn.'
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-neutral-900">
            {tr('Photos:')} {photoCount} / {MAX_PHOTOS}
          </div>

          {needsMorePhotos ? (
            <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              {tr('Add')} {remainingNeeded} {tr('more to unlock earning')}
            </div>
          ) : (
            <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
              {tr('Minimum photo requirement met')}
            </div>
          )}
        </div>

        <div className="mt-3 text-xs leading-5 text-neutral-500">
          {tr('The active main photo is the one used across LoveF8. You can upload up to')}{' '}
          {MAX_PHOTOS} {tr('photos total.')}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-sm font-semibold text-neutral-900">{tr('Main Photo')}</div>

        <div className="mt-3 flex items-start gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
            {mainPhoto ? (
              <img
                src={mainPhoto.url}
                alt={tr('Main profile')}
                className="h-full w-full object-cover"
              />
            ) : currentAvatarUrl ? (
              <img
                src={currentAvatarUrl}
                alt={tr('Main profile')}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-medium text-neutral-500">
                {tr('No photo')}
              </div>
            )}
          </div>

          <div className="flex-1">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50">
              {uploading ? tr('Uploading...') : tr('Upload Photo')}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading || photoCount >= MAX_PHOTOS}
                multiple
              />
            </label>

            <div className="mt-2 text-xs text-neutral-500">
              {tr('JPG, PNG, or WEBP. You can select more than one photo at once.')}
            </div>

            {photoCount >= MAX_PHOTOS ? (
              <div className="mt-2 text-xs font-medium text-amber-700">
                {tr('You have reached the maximum of')} {MAX_PHOTOS} {tr('photos.')}
              </div>
            ) : null}

            {loadingPhotos ? (
              <div className="mt-2 text-xs text-neutral-500">{tr('Loading photos...')}</div>
            ) : null}

            {error ? (
              <div className="mt-2 text-sm font-medium text-red-600">{error}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-neutral-900">{tr('Photo Gallery')}</div>

        {photos.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
            {tr('No photos uploaded yet.')}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => {
              const isBusy = busyPath === photo.path;

              return (
                <div
                  key={photo.path}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="aspect-[4/5] bg-neutral-100">
                    <img
                      src={photo.url}
                      alt={tr('Profile gallery')}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-neutral-900">
                        {photo.isMain ? tr('Main Photo') : tr('Extra Photo')}
                      </div>

                      {photo.isMain ? (
                        <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {tr('Active')}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex gap-2">
                      {!photo.isMain ? (
                        <button
                          type="button"
                          onClick={() => handleSetMain(photo.path)}
                          disabled={isBusy}
                          className="rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? tr('Saving...') : tr('Set Main')}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleDelete(photo.path)}
                        disabled={isBusy}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? tr('Working...') : tr('Delete')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}