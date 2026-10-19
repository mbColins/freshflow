// Links that open the phone dialer or WhatsApp for a stored phone number

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

export const whatsappHref = (phone: string, message?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`
