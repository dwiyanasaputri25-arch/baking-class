import { ArrowUpRight, Clock3, MapPin, Sparkles } from 'lucide-react';
import { money, dateLabel } from '../api.js';

const accents = ['from-rose-100 to-orange-50', 'from-orange-100 to-amber-50', 'from-purple-100 to-rose-50'];
const illustrations = ['🧁', '🥐', '🎂', '🍰'];

export default function ClassCard({ course, index, onSelect }) {
  return (
    <article className="group overflow-hidden rounded-[1.65rem] border border-cocoa/10 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className={`relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br ${accents[index % accents.length]}`}>
        {course.image_url ? (
          <img src={course.image_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <span className="dessert-illustration" aria-hidden="true">{illustrations[index % illustrations.length]}</span>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold tracking-wide text-rose shadow-sm">
          {course.category}
        </span>
        {Number(course.available_schedules) > 0 && (
          <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-cocoa">
            <Sparkles size={13} className="text-caramel" /> {course.available_schedules} jadwal tersedia
          </span>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-display text-2xl leading-tight text-cocoa">{course.class_name}</h3>
        <p className="mt-3 min-h-12 text-sm leading-6 text-cocoa/65">{course.description || 'Belajar teknik baking dalam suasana yang hangat dan menyenangkan.'}</p>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-cocoa/55">
          {course.next_schedule_date && (
            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> {dateLabel(course.next_schedule_date)}</span>
          )}
          <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> Studio Pangkalpinang</span>
        </div>
        <div className="mt-6 flex items-end justify-between border-t border-cocoa/10 pt-5">
          <span>
            <span className="block text-xs font-semibold text-cocoa/50">Mulai dari</span>
            <span className="mt-1 block text-lg font-extrabold text-rose">{money(course.price)}</span>
          </span>
          <button onClick={() => onSelect(course.class_id)} className="button-primary !px-4 !py-2.5">
            Lihat kelas <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
