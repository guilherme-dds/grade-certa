import type { ComponentProps } from 'react'
import { buttonStyles, type ButtonStyleProps } from './buttonStyles'

type ButtonProps = ComponentProps<'button'> & ButtonStyleProps

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size }, className)} {...props} />
}
