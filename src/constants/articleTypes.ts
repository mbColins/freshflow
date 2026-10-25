// The backend's ArticleType constants and how people read them
export const ARTICLE_TYPES: { id: string; label: string }[] = [
  ['SHIRT', 'Shirt'], ['T_SHIRT', 'T-Shirt'], ['TROUSER', 'Trouser'], ['JEANS', 'Jeans'], ['SUIT', 'Suit'],
  ['JACKET', 'Jacket'], ['COAT', 'Coat'], ['DRESS', 'Dress'], ['SKIRT', 'Skirt'], ['SHORTS', 'Shorts'],
  ['SWEATER', 'Sweater'], ['HOODIE', 'Hoodie'], ['UNIFORM', 'Uniform'], ['TRADITIONAL_WEAR', 'Traditional Wear'],
  ['BEDSHEET', 'Bedsheet'], ['BLANKET', 'Blanket'], ['DUVET', 'Duvet'], ['PILLOWCASE', 'Pillowcase'],
  ['CURTAIN', 'Curtain'], ['TOWEL', 'Towel'], ['TABLE_CLOTH', 'Table Cloth'], ['CARPET', 'Carpet'], ['RUG', 'Rug'],
  ['SOFA_COVER', 'Sofa Cover'], ['WEDDING_DRESS', 'Wedding Dress'], ['SILK_GARMENT', 'Silk Garment'],
  ['LEATHER_JACKET', 'Leather Jacket'], ['SUEDE_ITEM', 'Suede Item'], ['WOOL_GARMENT', 'Wool Garment'],
  ['SHOES', 'Shoes'], ['SNEAKERS', 'Sneakers'], ['CAP', 'Cap'], ['HAT', 'Hat'], ['TIE', 'Tie'], ['SCARF', 'Scarf'],
  ['BAG', 'Bag'],
].map(([id, label]) => ({ id, label }))

export const articleLabel = (id: string) => ARTICLE_TYPES.find((type) => type.id === id)?.label ?? id
