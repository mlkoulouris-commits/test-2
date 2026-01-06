/**
 * Utility functions for collecting submission metadata
 * Includes browser, device, IP, and geolocation information
 */

export interface SubmissionMetadata {
  browser?: string
  device?: string
  user_agent?: string
  screen_resolution?: string
  timezone?: string
  language?: string
  platform?: string
  geolocation?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  timestamp: string
}

/**
 * Detect browser name from user agent
 */
const detectBrowser = (): string => {
  const ua = navigator.userAgent
  
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
  if (ua.includes('Opera/') || ua.includes('OPR/')) return 'Opera'
  
  return 'Unknown'
}

/**
 * Detect device type from user agent and screen width
 */
const detectDevice = (): string => {
  const ua = navigator.userAgent
  const width = window.screen.width
  
  if (/Mobile|Android|iPhone|iPod/.test(ua)) return 'Mobile'
  if (/iPad|Tablet/.test(ua)) return 'Tablet'
  if (width < 768) return 'Mobile'
  if (width >= 768 && width < 1024) return 'Tablet'
  
  return 'Desktop'
}

/**
 * Request geolocation from the browser
 * Returns a promise that resolves with coordinates or null if denied/unavailable
 */
export const requestGeolocation = (): Promise<GeolocationPosition | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null), // Don't fail if user denies
      {
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
        enableHighAccuracy: true
      }
    )
  })
}

/**
 * Collect all available submission metadata
 * @param includeGeolocation - Whether to request geolocation (requires user permission)
 */
export const collectSubmissionMetadata = async (
  includeGeolocation: boolean = true
): Promise<SubmissionMetadata> => {
  const metadata: SubmissionMetadata = {
    browser: detectBrowser(),
    device: detectDevice(),
    user_agent: navigator.userAgent,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    timestamp: new Date().toISOString(),
  }

  // Optionally collect geolocation
  if (includeGeolocation) {
    const position = await requestGeolocation()
    if (position) {
      metadata.geolocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }
    }
  }

  return metadata
}

/**
 * Format metadata for display
 */
export const formatMetadataForDisplay = (metadata: SubmissionMetadata | null): string => {
  if (!metadata) return 'No metadata available'
  
  const parts = []
  
  if (metadata.browser) parts.push(metadata.browser)
  if (metadata.device) parts.push(metadata.device)
  if (metadata.geolocation) {
    parts.push(`GPS: ${metadata.geolocation.latitude.toFixed(6)}, ${metadata.geolocation.longitude.toFixed(6)}`)
  }
  
  return parts.join(' • ')
}





































