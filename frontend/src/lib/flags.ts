// SVG flags, not emoji (🇻🇳 etc.) — emoji flags are unreliable cross-platform,
// notably on Windows, whose fonts have no flag glyphs at all and fall back to
// showing the raw two-letter code as text instead of a flag.
//
// Individual flag imports, not the flag-icons CSS sprite, so Vite only bundles
// the 7 flags actually used here, not all ~250 in the package.
import au from 'flag-icons/flags/4x3/au.svg'
import cn from 'flag-icons/flags/4x3/cn.svg'
import eu from 'flag-icons/flags/4x3/eu.svg'
import gb from 'flag-icons/flags/4x3/gb.svg'
import jp from 'flag-icons/flags/4x3/jp.svg'
import us from 'flag-icons/flags/4x3/us.svg'
import vn from 'flag-icons/flags/4x3/vn.svg'
import type { CurrencyCode } from './currency'

export const CURRENCY_FLAG_SRC: Record<CurrencyCode, string> = {
  USD: us,
  EUR: eu,
  GBP: gb,
  AUD: au,
  JPY: jp,
  CNY: cn,
  VND: vn,
}
