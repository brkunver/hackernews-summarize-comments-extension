export function truncateUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname + urlObj.search
  } catch {
    return url
  }
}

export function truncateSummary(summary: string, maxLength = 50): string {
  return summary.length > maxLength ? `${summary.substring(0, maxLength)}...` : summary
}

export function getExtensionVersion(): string {
  return browser.runtime.getManifest().version
}
