import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, ChevronLeft, ChevronRight, Loader2, CalendarIcon, Clock } from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
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
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState(preFillName);
  const [visitorEmail, setVisitorEmail] = useState(preFillEmail);
  const [visitorPhone, setVisitorPhone] = useState(preFillPhone);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookedSlot, setBookedSlot] = useState<string | null>(null);
  const [calendarOffset, setCalendarOffset] = useState(0); // 14-day pages

  // Generate 14 days starting from today
  const today = startOfDay(new Date());
  const calendarDays = Array.from({ length: 14 }, (_, i) =>
    addDays(today, i + calendarOffset * 14)
  );

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

      const { error } = await supabase.functions.invoke("google-calendar-book", {
        body: {
          organization_id: organizationId,
          start_datetime: selectedSlot,
          duration_minutes: slotDuration,
          title: visitorName ? `Agendamento — ${visitorName}` : "Agendamento",
          description: descParts.join("\n"),
          attendee_email: visitorEmail || undefined,
        },
      });
      if (error) throw error;
      setBooked(true);
      setBookedSlot(selectedSlot);
    } catch (err) {
      console.error("Booking error:", err);
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
        {watermarkText && (
          <p className="text-xs text-muted-foreground/60">{watermarkText}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10 gap-8">
      {brandLogo}

      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-foreground">{title}</h2>
        </div>

        {/* Date selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" /> Escolha uma data
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={calendarOffset === 0}
                onClick={() => setCalendarOffset((o) => o - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCalendarOffset((o) => o + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isAvailableDay = availableDays.includes(day.getDay());
              const isSelected = isSameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  disabled={!isAvailableDay}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold"
                      : isAvailableDay
                      ? "hover:bg-muted text-foreground"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  }`}
                >
                  <span className="text-[10px] uppercase">
                    {format(day, "EEE", { locale: ptBR }).slice(0, 3)}
                  </span>
                  <span className="font-semibold mt-0.5">{format(day, "d")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slots */}
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Horários disponíveis
          </p>
          {loadingSlots ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.filter((s) => s.available).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum horário disponível neste dia.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots
                .filter((s) => s.available)
                .map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => setSelectedSlot(slot.time)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      selectedSlot === slot.time
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {format(new Date(slot.time), "HH:mm")}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Visitor data + confirm */}
        {selectedSlot && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Seus dados</p>
            {(
              [
                { label: "Nome", value: visitorName, setter: setVisitorName, type: "text", placeholder: "Seu nome" },
                { label: "E-mail", value: visitorEmail, setter: setVisitorEmail, type: "email", placeholder: "seu@email.com" },
                { label: "WhatsApp", value: visitorPhone, setter: setVisitorPhone, type: "tel", placeholder: "(11) 99999-9999" },
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

            <div className="pt-2 space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Horário selecionado:{" "}
                <strong>
                  {format(new Date(selectedSlot), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </strong>
              </p>
              <Button
                size="lg"
                className="w-full h-12 rounded-xl"
                onClick={handleBook}
                disabled={booking}
              >
                {booking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar agendamento"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {watermarkText && (
        <p className="text-xs text-muted-foreground/60 text-center">{watermarkText}</p>
      )}
    </div>
  );
}
