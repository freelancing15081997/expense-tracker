import { useState } from 'react';
import { useMobileFeatures } from '../hooks/useMobileFeatures';
import { ImpactStyle } from '../lib/capacitor';

export function MobileFeaturesDemo() {
  const mobile = useMobileFeatures();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleTakePhoto = async () => {
    try {
      await mobile.hapticFeedback(ImpactStyle.Light);
      const image = await mobile.capturePhoto();
      setImageUrl(image.dataUrl || null);
      await mobile.showToast('Photo captured!');
    } catch (error) {
      console.error('Error taking photo:', error);
      await mobile.showToast('Failed to take photo');
    }
  };

  const handleSelectImage = async () => {
    try {
      await mobile.hapticFeedback(ImpactStyle.Light);
      const image = await mobile.selectImage();
      setImageUrl(image.dataUrl || null);
      await mobile.showToast('Image selected!');
    } catch (error) {
      console.error('Error selecting image:', error);
      await mobile.showToast('Failed to select image');
    }
  };

  const handleGetLocation = async () => {
    try {
      await mobile.hapticFeedback(ImpactStyle.Light);
      const position = await mobile.getCurrentPosition();
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      await mobile.showToast('Location retrieved!');
    } catch (error) {
      console.error('Error getting location:', error);
      await mobile.showToast('Failed to get location');
    }
  };

  const handleShare = async () => {
    try {
      await mobile.hapticFeedback(ImpactStyle.Light);
      await mobile.shareContent({
        title: 'Byjan - Financial Tracking',
        text: 'Check out this amazing financial tracking app!',
        url: 'https://byjan.com',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleScheduleNotification = async () => {
    try {
      await mobile.hapticFeedback(ImpactStyle.Light);
      await mobile.scheduleNotification({
        title: 'Reminder',
        body: 'This is a test notification!',
        schedule: { at: new Date(Date.now() + 5000) },
      });
      await mobile.showToast('Notification scheduled for 5 seconds');
    } catch (error) {
      console.error('Error scheduling notification:', error);
      await mobile.showToast('Failed to schedule notification');
    }
  };

  if (!mobile.isMobile) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          Mobile features are only available on mobile devices.
          Please open this app on your Android or iOS device to test these features.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Mobile Features Demo</h2>
        
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2">Platform Info</h3>
          <p className="text-sm">Platform: {mobile.isAndroid ? 'Android' : mobile.isIOS ? 'iOS' : 'Web'}</p>
          <p className="text-sm">Network: {mobile.networkStatus.connected ? 'Connected' : 'Disconnected'} 
            ({mobile.networkStatus.connectionType})</p>
          {mobile.pushToken && (
            <p className="text-sm break-all">Push Token: {mobile.pushToken.substring(0, 20)}...</p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Camera</h3>
            <div className="flex gap-2">
              <button
                onClick={handleTakePhoto}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                📷 Take Photo
              </button>
              <button
                onClick={handleSelectImage}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                🖼️ Select Image
              </button>
            </div>
            {imageUrl && (
              <div className="mt-4">
                <img src={imageUrl} alt="Captured" className="max-w-full h-auto rounded-lg" />
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Geolocation</h3>
            <button
              onClick={handleGetLocation}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              📍 Get Location
            </button>
            {location && (
              <div className="mt-2 p-3 bg-gray-50 rounded">
                <p className="text-sm">Latitude: {location.lat.toFixed(6)}</p>
                <p className="text-sm">Longitude: {location.lng.toFixed(6)}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Sharing</h3>
            <button
              onClick={handleShare}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              📤 Share App
            </button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Notifications</h3>
            <button
              onClick={handleScheduleNotification}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
            >
              🔔 Schedule Notification
            </button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Haptic Feedback</h3>
            <div className="flex gap-2">
              <button
                onClick={() => mobile.hapticFeedback(ImpactStyle.Light)}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
              >
                Light
              </button>
              <button
                onClick={() => mobile.hapticFeedback(ImpactStyle.Medium)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Medium
              </button>
              <button
                onClick={() => mobile.hapticFeedback(ImpactStyle.Heavy)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Heavy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
