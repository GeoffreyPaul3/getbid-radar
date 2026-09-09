import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type CurrencyInfo = {
  code: string;
  name: string;
  symbol?: string;
};

/**
 * Complete ISO 4217 currency dataset with primary African, European,
 * American, Asian, and global trading currencies.
 */
export const ISO_4217_CURRENCIES: CurrencyInfo[] = [
  // Primary regional & global trade currencies
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK" },
  { code: "USD", name: "United States Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound Sterling", symbol: "£" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
  { code: "BWP", name: "Botswana Pula", symbol: "P" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵" },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "ZWL", name: "Zimbabwean Dollar", symbol: "Z$" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "₨" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },

  // Global major & trading currencies
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "AED", name: "United Arab Emirates Dirham", symbol: "AED" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪" },
  { code: "CLP", name: "Chilean Peso", symbol: "CLP$" },
  { code: "COP", name: "Colombian Peso", symbol: "COL$" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "ARS", name: "Argentine Peso", symbol: "ARS$" },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD" },
  { code: "OMR", name: "Omani Rial", symbol: "OMR" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "JD" },
];

export function findCurrency(code: string): CurrencyInfo | undefined {
  const normalized = code.trim().toUpperCase();
  return ISO_4217_CURRENCIES.find((c) => c.code === normalized);
}

export function formatCurrencyDisplay(code: string): string {
  const found = findCurrency(code);
  if (!found) return code.toUpperCase();
  return `${found.code} — ${found.name}`;
}

interface CurrencyComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function CurrencyCombobox({
  value,
  onChange,
  disabled = false,
  className,
  id,
}: CurrencyComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const normalizedValue = (value || "USD").toUpperCase();
  const selectedCurrency = findCurrency(normalizedValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-xs h-9 bg-surface border-border",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selectedCurrency ? (
              <span className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground">{selectedCurrency.code}</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-foreground truncate">{selectedCurrency.name}</span>
                {selectedCurrency.symbol && (
                  <span className="font-mono text-[10px] text-muted-foreground/80 shrink-0">
                    ({selectedCurrency.symbol})
                  </span>
                )}
              </span>
            ) : (
              normalizedValue || "Select currency..."
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search currency code or name..." className="h-9 text-xs" />
          <CommandList className="max-h-60">
            <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
              No matching ISO currency found.
            </CommandEmpty>
            <CommandGroup>
              {ISO_4217_CURRENCIES.map((currency) => (
                <CommandItem
                  key={currency.code}
                  value={`${currency.code} ${currency.name}`}
                  onSelect={() => {
                    onChange(currency.code);
                    setOpen(false);
                  }}
                  className="text-xs flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-accent",
                        normalizedValue === currency.code ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-mono font-bold text-foreground shrink-0">
                      {currency.code}
                    </span>
                    <span className="text-muted-foreground text-xs truncate">{currency.name}</span>
                  </div>
                  {currency.symbol && (
                    <span className="font-mono text-[10px] text-muted-foreground ml-2 shrink-0">
                      {currency.symbol}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
