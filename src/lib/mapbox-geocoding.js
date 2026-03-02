t fetch origin

# Force push (overwrites remote with your local changes)
git push origin main --force
Enumerating objects: 1105, done.
Counting objects: 100% (1105/1105), done.
Delta compression using up to 8 threads
Compressing objects: 100% (972/972), done.
Writing objects: 100% (1105/1105), 4.14 MiB | 3.47 MiB/s, done.
Total 1105 (delta 402), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (402/402), done.
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: 
remote: - GITHUB PUSH PROTECTION
remote:   —————————————————————————————————————————
remote:     Resolve the following violations before pushing again
remote:
remote:     - Push cannot contain secrets
remote:
remote:
remote:      (?) Learn how to resolve a blocked push
remote:      https://docs.github.com/code-security/secret-scanning/working-with-secret-scanning-and-push-protection/working-with-push-protection-from-the-command-line#resolving-a-blocked-push
remote:
remote:
remote:       —— Mapbox Secret Access Token ————————————————————————
remote:        locations:
remote:          - commit: 617bb0228e6cde92e9e24980e25760bb095e30b9
remote:            path: src/lib/mapbox-geocoding.js:2
remote:
remote:        (?) To push, remove secret from commit(s) or follow this URL to allow the secret.       
remote:        https://github.com/TakundaMabukwa/Waterford/security/secret-scanning/unblock-secret/3ANeTYSAdKr9eXgJaVqdVkfYzxB
remote:
remote:
remote:
To https://github.com/TakundaMabukwa/Waterford.git
 ! [remote rejected] main -> main (push declined due to repository rule violations)
error: failed to push some refs to 'https://github.com/TakundaMabukwa/Waterford.git'

mabuk@Latitude MINGW64 ~/Desktop/Systems/eps - Copy/breakdownDashboard (main)
$const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

/**
 * Geocode an address to get coordinates using Mapbox Geocoding API
 */
export async function geocodeAddress(address) {
  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`
    )

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const [lng, lat] = feature.center

      return {
        lat,
        lng,
        formatted_address: feature.place_name,
        place_name: feature.place_name,
      }
    }

    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

/**
 * Geocode from form data (street, city, state, country)
 */
export async function geocodeFromFormData(formData) {
  const { street, city, state, country } = formData

  if (!street || !city || !state || !country) {
    return null
  }

  const address = `${street}, ${city}, ${state}, ${country}`
  return geocodeAddress(address)
}

/**
 * Reverse geocode coordinates to get address components
 */
export async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address`
    )

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const context = feature.context || []

      const street = feature.text || ''
      let city = ''
      let state = ''
      let country = ''

      context.forEach((item) => {
        if (item.id.startsWith('place')) {
          city = item.text
        } else if (item.id.startsWith('region')) {
          state = item.text
        } else if (item.id.startsWith('country')) {
          country = item.text
        }
      })

      return {
        street,
        city,
        state,
        country,
        formatted_address: feature.place_name,
      }
    }

    return null
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return null
  }
}

/**
 * Search for places/addresses with autocomplete
 */
export async function searchPlaces(query, limit = 5) {
  try {
    if (!query || query.length < 3) {
      return []
    }

    const encodedQuery = encodeURIComponent(query)
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=${limit}&types=address,poi`
    )

    if (!response.ok) {
      throw new Error(`Place search failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.features || []
  } catch (error) {
    console.error('Place search error:', error)
    return []
  }
}
