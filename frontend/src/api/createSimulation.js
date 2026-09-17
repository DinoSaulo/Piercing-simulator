/**
 * Envia a simulacao como multipart/form-data para o Express.
 *
 * O caminho e relativo ("/api"): em dev o proxy do Vite encaminha para o
 * backend, em producao o mesmo caminho vale atras do reverse proxy.
 */
export async function createSimulation({
  gender,
  genderOther,
  bodyPart,
  bodyPartOther,
  style,
  image,
}) {
  const formData = new FormData()
  formData.append('gender', gender)
  formData.append('bodyPart', bodyPart)
  formData.append('style', style)
  formData.append('consent', 'true')

  if (genderOther) formData.append('genderOther', genderOther)
  if (bodyPartOther) formData.append('bodyPartOther', bodyPartOther)
  if (image) formData.append('image', image, image.name)

  const response = await fetch('/api/simulate', { method: 'POST', body: formData })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error ?? `A API respondeu ${response.status}.`)
  }

  return payload
}
