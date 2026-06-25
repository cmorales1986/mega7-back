using System;
using System.Collections.Generic;

namespace Mega7.SHARED.Entities
{
    public enum JournalEntrySource
    {
        Manual    = 0,
        Venta     = 1,
        Compra    = 2,
        Pago      = 3,
        Cobro     = 4,
        Banco     = 5,
        Caja      = 6,
        Ajuste    = 7,
    }

    public enum JournalEntryStatus
    {
        Borrador  = 0,  // editable
        Contabilizado = 1,  // no editable
    }

    public class JournalEntry
    {
        public int Id { get; set; }
        public DateTime Date { get; set; }
        public string Description { get; set; } = null!;
        public string? Reference { get; set; }   // nro de asiento manual, o "FAC-0001", etc.

        public JournalEntrySource SourceType { get; set; } = JournalEntrySource.Manual;
        public int? SourceId { get; set; }       // FK flexible al doc. origen

        public JournalEntryStatus Status { get; set; } = JournalEntryStatus.Borrador;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string? CreatedBy { get; set; }

        public List<JournalEntryLine> Lines { get; set; } = new();
    }

    public class JournalEntryLine
    {
        public int Id { get; set; }
        public int JournalEntryId { get; set; }
        public JournalEntry JournalEntry { get; set; } = null!;

        public int AccountId { get; set; }
        public Account Account { get; set; } = null!;

        public decimal Debit  { get; set; } = 0;  // Debe
        public decimal Credit { get; set; } = 0;  // Haber
        public string? Description { get; set; }
    }
}
