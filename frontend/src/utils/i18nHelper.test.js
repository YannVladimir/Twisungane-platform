import { describe, it, expect } from 'vitest'
import { frw, getLocale } from './i18nHelper'

describe('frw', () => {
  it('formats a positive amount with thousand separators and an FRW suffix', () => {
    expect(frw(1500000, 'en')).toBe('1,500,000 FRW')
  })

  it('rounds to whole numbers (no FRW cents are ever shown)', () => {
    expect(frw(1234.56, 'en')).toBe('1,235 FRW')
  })

  it('treats non-numeric input as zero instead of throwing or showing NaN', () => {
    expect(frw('not-a-number', 'en')).toBe('0 FRW')
    expect(frw(undefined, 'en')).toBe('0 FRW')
    expect(frw(null, 'en')).toBe('0 FRW')
  })

  it('accepts numeric strings (as come back from some API responses)', () => {
    expect(frw('50000', 'en')).toBe('50,000 FRW')
  })

  it('uses a French locale grouping for the fr language', () => {
    // fr-FR groups with a non-breaking space rather than a comma.
    const result = frw(1500000, 'fr')
    expect(result).toContain('FRW')
    expect(result).not.toContain(',')
  })
})

describe('getLocale', () => {
  it('maps fr to fr-FR', () => {
    expect(getLocale('fr')).toBe('fr-FR')
  })

  it('maps ky (Kinyarwanda) to rw-RW', () => {
    expect(getLocale('ky')).toBe('rw-RW')
  })

  it('defaults any other language (including English) to en-GB', () => {
    expect(getLocale('en')).toBe('en-GB')
    expect(getLocale('unknown')).toBe('en-GB')
    expect(getLocale(undefined)).toBe('en-GB')
  })
})
