import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  CalendarIcon,
  Clock,
  Search,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isBefore,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Slot {
  time: string;
  available: boolean;
}

interface BookingPageProps {
  organizationId: string;
  title?: string;
  slotDuration?: number;
  availabilityStart?: string;
  availabilityEnd?: string;
  availableDays?: number[];
  advanceHours?: number;
  preFillName?: string;
  preFillEmail?: string;
  preFillPhone?: string;
  watermarkText?: string;
  brandLogo?: React.ReactNode;
}

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function BookingPage({
  organizationId,
  title = "Agende seu horário",
  slotDuration = 30,
  availabilityStart = "09:00",
  availabilityEnd = "18:00",
  availableDays = [1, 2, 3, 4, 5],
  advanceHours = 0,
  preFillName = "",
  preFillEmail = "",
  preFillPhone = "",
  watermarkText,
  brandLogo,
}: BookingPageProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState(preFillName);
  const [visitorEmail, setVisitorEmail] = useState(preFillEmail);
  const [visitorPhone, setVisitorPhone] = useState(preFillPhone);
  const [observations, setObservations] = useState("");
  const [includeMeet, setIncludeMeet] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookedSlot, setBookedSlot] = useState<string | null>(null);

  const today = startOfDay(new Date());

  const monthGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  const loadSlots = useCallback(
    async (date: Date) => {
      setLoadingSlots(true);
      setSlots([]);
      setSelectedSlot(null);
      try {
        const { data, error } = await supabase.functions.invoke("google-calendar-slots", {
          body: {
            organization_id: organizationId,
            date: format(date, "yyyy-MM-dd"),
            slot_duration: slotDuration,
            availability_start: availabilityStart,
            availability_end: availabilityEnd,
            available_days: availableDays,
            advance_hours: advanceHours,
          },
        });
        if (error) throw error;
        setSlots(data?.slots || []);
      } catch (err) {
        console.error("Slots error:", err);
      } finally {
        setLoadingSlots(false);
      }
    },
    [organizationId, slotDuration, availabilityStart, availabilityEnd, advanceHours, availableDays]
  );

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      const descParts: string[] = [];
      if (visitorName) descParts.push(`Nome: ${visitorName}`);
      if (visitorEmail) descParts.push(`E-mail: ${visitorEmail}`);
      if (visitorPhone) descParts.push(`WhatsApp: ${visitorPhone}`);

      const { data, error } = await supabase.functions.invoke("google-calendar-book", {
        body: {
          organization_id: organizationId,
          start_datetime: selectedSlot,
          duration_minutes: slotDuration,
          title: visitorName ? `Agendamento — ${visitorName}` : "Agendamento",
          description: descParts.join("\n"),
          observations: observations.trim() || undefined,
          include_meet: includeMeet,
          attendee_email: visitorEmail || undefined,
        },
      });

      if (error || data?.error) {
        console.error("Booking error:", error, data);
        toast.error(data?.error || "Erro ao criar agendamento. Tente novamente.");
        return;
      }

      setBooked(true);
      setBookedSlot(selectedSlot);
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Erro ao criar agendamento. Tente novamente.");
    } finally {
      setBooking(false);
    }
  };

  if (booked && bookedSlot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 gap-6 text-center">
        {brandLogo}
        <CheckCircle className="h-16 w-16 text-success" />
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">Agendamento confirmado!</h2>
          <p className="text-muted-foreground text-sm">
            {format(new Date(bookedSlot), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        {watermarkText && <p className="text-xs text-muted-foreground/60">{watermarkText}</p>}
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10 gap-8">
      {brandLogo}

      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground break-words">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Escolha um dia e um horário disponível
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          {/* Month calendar */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold flex items-center gap-2 text-foreground capitalize">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Mês anterior"
                  disabled={isSameMonth(visibleMonth, today) || isBefore(visibleMonth, today)}
                  onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Próximo mês"
                  onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((d) => (
                <span
                  key={d}
                  className="text-[10px] font-semibold text-muted-foreground text-center py-1"
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((day) => {
                const inMonth = isSameMonth(day, visibleMonth);
                const isPast = isBefore(day, today);
                const isEnabledDay = availableDays.includes(day.getDay()) && !isPast && inMonth;
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={!isEnabledDay}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                      isSelected && isEnabledDay
                        ? "bg-primary text-primary-foreground font-bold"
                        : isEnabledDay
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground/30 cursor-not-allowed"
                    }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              Horário de Brasília (UTC-3)
            </p>
          </div>

          {/* Time slots */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span className="capitalize">
                {format(selectedDate, "EEEE, d 'de' MMM", { locale: ptBR })}
              </span>
            </p>

            {loadingSlots ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Nenhum horário disponível neste dia.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto quantum-scrollbar pr-1">
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlot === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedSlot(slot.time)}
                      className={`w-full rounded-xl border px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/60 hover:bg-muted/50"
                      }`}
                    >
                      <span className="block text-base font-semibold">
                        {format(new Date(slot.time), "HH:mm")}
                      </span>
                      <span
                        className={`block text-xs ${
                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {slotDuration} min
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Visitor data */}
        {selectedSlot && (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">Seus dados</p>

            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  { label: "Nome", value: visitorName, setter: setVisitorName, type: "text", placeholder: "Seu nome" },
                  { label: "E-mail", value: visitorEmail, setter: setVisitorEmail, type: "email", placeholder: "seu@email.com" },
                  { label: "WhatsApp", value: visitorPhone, setter: setVisitorPhone, type: "tel", placeholder: "+55 11 91234-5678" },
                ] as const
              ).map(({ label, value, setter, type, placeholder }) => (
                <div key={label} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Observações (opcional)</label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Algo que devemos saber antes da reunião?"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Incluir Google Meet</p>
                  <p className="text-xs text-muted-foreground">Criar link de videoconferência</p>
                </div>
              </div>
              <Switch checked={includeMeet} onCheckedChange={setIncludeMeet} />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Horário selecionado:{" "}
              <strong className="text-foreground">
                {format(new Date(selectedSlot), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </strong>
            </p>

            <Button
              size="lg"
              className="w-full h-12 rounded-xl text-base font-semibold"
              onClick={handleBook}
              disabled={booking}
            >
              {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar agendamento"}
            </Button>
          </div>
        )}
      </div>

      {watermarkText && (
        <p className="text-xs text-muted-foreground/60 text-center">{watermarkText}</p>
      )}
    </div>
  );
}
