import { motion, AnimatePresence } from "framer-motion"
import {
  useMotionEnabled,
  fadeIn,
  fadeInUp,
  fadeInRight,
  scaleIn,
  staggerContainer,
  defaultTransition,
  slowTransition,
} from "@/lib/motion"

interface WrapperProps {
  children: React.ReactNode
  className?: string
}

interface KeyedWrapperProps extends WrapperProps {
  motionKey: string
}

interface DelayProps extends WrapperProps {
  delay?: number
}

export function PageFade({ children, motionKey, className }: KeyedWrapperProps) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={motionKey}
        variants={fadeIn}
        initial="hidden"
        animate="show"
        exit="hidden"
        transition={defaultTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function SectionReveal({ children, className }: WrapperProps) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      transition={slowTransition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function CardReveal({ children, className, delay = 0 }: DelayProps) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      transition={{ ...defaultTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SlideInRight({ children, className }: WrapperProps) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <motion.div
      variants={fadeInRight}
      initial="hidden"
      animate="show"
      transition={defaultTransition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function FadeIn({ children, className }: WrapperProps) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      transition={defaultTransition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({
  children,
  className,
  stagger = 0.06,
  delay = 0.05,
}: WrapperProps & { stagger?: number; delay?: number }) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <motion.div
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerInView({
  children,
  className,
  stagger = 0.06,
  delay = 0.05,
}: WrapperProps & { stagger?: number; delay?: number }) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <motion.div
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: WrapperProps) {
  const enabled = useMotionEnabled()
  if (!enabled) return <div className={className}>{children}</div>
  return (
    <motion.div variants={fadeInUp} className={className}>
      {children}
    </motion.div>
  )
}

export function MessageBubble({ children, className, isNew }: WrapperProps & { isNew: boolean }) {
  const enabled = useMotionEnabled()
  if (!enabled || !isNew) return <div className={className}>{children}</div>
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={defaultTransition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { motion }
