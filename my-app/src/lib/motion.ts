import { useReducedMotion } from "framer-motion"
import type { Variants, Transition } from "framer-motion"

export function useMotionEnabled(): boolean {
  return !useReducedMotion()
}

export const ease = [0.22, 1, 0.36, 1] as const

export const defaultTransition: Transition = {
  duration: 0.28,
  ease,
}

export const slowTransition: Transition = {
  duration: 0.4,
  ease,
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: defaultTransition },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: defaultTransition },
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 8 },
  show: { opacity: 1, x: 0, transition: defaultTransition },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  show: { opacity: 1, scale: 1, transition: defaultTransition },
}

export function staggerContainer(stagger = 0.06, delay = 0.05): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  }
}
