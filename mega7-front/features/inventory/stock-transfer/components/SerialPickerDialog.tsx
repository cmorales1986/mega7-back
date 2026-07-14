// src/features/inventory/stock-transfer/components/SerialPickerDialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SerialPickDto = {
  id: number;
  serialNumber: string;
  isActive: boolean;
};

export function SerialPickerDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  options: SerialPickDto[];
  qty: number;
  selected: string[];
  setSelected: (next: string[]) => void;
}) {
  const { open, onOpenChange, options, qty, selected, setSelected } = props;
  const [search, setSearch] = React.useState("");

  const filtered = options.filter((s) =>
    (s.serialNumber ?? "").toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl shadow-xl border p-6 max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Seleccionar seriales</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Buscar serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="h-[360px] overflow-auto border rounded-md p-3 space-y-2">
            {filtered.map((s) => {
              const sn = s.serialNumber;
              const checked = selected.includes(sn);
              const disableCheck = !checked && selected.length >= qty;

              return (
                <label key={s.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableCheck}
                    onChange={(e) => {
                      const isOn = e.target.checked;
                      if (isOn) {
                        if (selected.length >= qty) return;
                        setSelected([...selected, sn]);
                      } else {
                        setSelected(selected.filter((x) => x !== sn));
                      }
                    }}
                  />
                  <span className={disableCheck ? "text-gray-400" : ""}>{sn}</span>
                </label>
              );
            })}
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Seleccionados: <b>{selected.length}</b> / {qty}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelected([])}>
                Limpiar
              </Button>
              <Button className="bg-[#2563eb] text-white" onClick={() => onOpenChange(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React from "react";
