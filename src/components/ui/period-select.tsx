import * as React from "react";
import { Check, ChevronsUpDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface PeriodOption {
  id: string;
  periodo: string;
  status: 'aberto' | 'fechado';
}

interface PeriodSelectProps {
  periods: PeriodOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  showStatus?: boolean;
  includeAllOption?: boolean;
  allOptionLabel?: string;
}

const PeriodSelect = React.forwardRef<HTMLButtonElement, PeriodSelectProps>(
  (
    {
      periods,
      value,
      onValueChange,
      placeholder = "Selecione o período",
      searchPlaceholder = "Buscar período...",
      emptyMessage = "Nenhum período encontrado.",
      className,
      disabled = false,
      showStatus = true,
      includeAllOption = false,
      allOptionLabel = "Todos os Períodos",
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);

    const selectedPeriod = periods.find((p) => p.id === value);
    const displayValue = selectedPeriod
      ? `${selectedPeriod.periodo}${showStatus ? (selectedPeriod.status === 'aberto' ? ' (Aberto)' : ' (Fechado)') : ''}`
      : value === 'todos' && includeAllOption
      ? allOptionLabel
      : placeholder;

    const options = includeAllOption
      ? [{ id: 'todos', periodo: allOptionLabel, status: 'aberto' as const }, ...periods]
      : periods;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-11 sm:h-10 w-full justify-between font-normal text-base sm:text-sm",
              !value && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <span className="truncate flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 opacity-50" />
              {displayValue}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 bg-popover"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="h-9" />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                ) : (
                  options.map((period) => {
                    const label = period.id === 'todos' 
                      ? period.periodo 
                      : `${period.periodo}${showStatus ? (period.status === 'aberto' ? ' (Aberto)' : ' (Fechado)') : ''}`;
                    const searchValue = period.id === 'todos'
                      ? period.periodo.toLowerCase()
                      : `${period.periodo} ${period.status}`.toLowerCase();
                    
                    return (
                      <CommandItem
                        key={period.id}
                        value={searchValue}
                        onSelect={() => {
                          onValueChange(period.id === value ? "" : period.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === period.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>{label}</span>
                      </CommandItem>
                    );
                  })
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

PeriodSelect.displayName = "PeriodSelect";

export { PeriodSelect };

