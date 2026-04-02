import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorClass: string;
  delay?: number;
}

const StatCard = ({ title, value, icon: Icon, colorClass, delay = 0 }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="glass-card rounded-xl p-5 hover:glow-sm transition-shadow duration-300"
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground font-medium">{title}</span>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
        <Icon className="w-4 h-4 text-primary-foreground" />
      </div>
    </div>
    <p className="text-3xl font-bold text-foreground">{value}</p>
  </motion.div>
);

export default StatCard;
