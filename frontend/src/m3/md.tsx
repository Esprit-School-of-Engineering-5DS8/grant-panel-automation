/*
 * Registers Google's official Material Design 3 web components
 * (@material/web) and exposes React-friendly typed aliases.
 */
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/iconbutton/filled-tonal-icon-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/textfield/filled-text-field.js'
import '@material/web/chips/assist-chip.js'
import '@material/web/chips/filter-chip.js'
import '@material/web/divider/divider.js'
import '@material/web/progress/linear-progress.js'
import type { FC } from 'react'

type MdProps = Record<string, unknown>

export const MdFilledButton = 'md-filled-button' as unknown as FC<MdProps>
export const MdFilledTonalButton = 'md-filled-tonal-button' as unknown as FC<MdProps>
export const MdOutlinedButton = 'md-outlined-button' as unknown as FC<MdProps>
export const MdTextButton = 'md-text-button' as unknown as FC<MdProps>
export const MdIconButton = 'md-icon-button' as unknown as FC<MdProps>
export const MdFilledTonalIconButton = 'md-filled-tonal-icon-button' as unknown as FC<MdProps>
export const MdOutlinedTextField = 'md-outlined-text-field' as unknown as FC<MdProps>
export const MdFilledTextField = 'md-filled-text-field' as unknown as FC<MdProps>
export const MdAssistChip = 'md-assist-chip' as unknown as FC<MdProps>
export const MdFilterChip = 'md-filter-chip' as unknown as FC<MdProps>
export const MdDivider = 'md-divider' as unknown as FC<MdProps>
export const MdLinearProgress = 'md-linear-progress' as unknown as FC<MdProps>

export const icon = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>
