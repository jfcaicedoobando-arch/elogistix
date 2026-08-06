import * as React from "react";

import { cn } from "@/lib/utils";

const Table = ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableElement> & { ref?: React.Ref<HTMLTableElement> }) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
Table.displayName = "Table";

const TableHeader = ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { ref?: React.Ref<HTMLTableSectionElement> }) => (
    <thead ref={ref} className={cn("sticky top-0 z-10 bg-muted/40 backdrop-blur-sm [&_tr]:border-b", className)} {...props} />
  );
TableHeader.displayName = "TableHeader";

const TableBody = ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { ref?: React.Ref<HTMLTableSectionElement> }) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
TableBody.displayName = "TableBody";

const TableFooter = ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & { ref?: React.Ref<HTMLTableSectionElement> }) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  );
TableFooter.displayName = "TableFooter";

const TableRow = ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { ref?: React.Ref<HTMLTableRowElement> }) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors duration-150 even:bg-muted/45 dark:even:bg-muted/30 data-[state=selected]:bg-muted hover:bg-primary/5", className)}
      {...props}
    />
  );
TableRow.displayName = "TableRow";

const TableHead = ({ ref, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { ref?: React.Ref<HTMLTableCellElement> }) => (
    <th
      ref={ref}
      className={cn(
        "h-9 px-3 text-left align-middle text-table-head uppercase tracking-wider text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
TableHead.displayName = "TableHead";

const TableCell = ({ ref, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { ref?: React.Ref<HTMLTableCellElement> }) => (
    <td ref={ref} className={cn("px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  );
TableCell.displayName = "TableCell";

const TableCaption = ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement> & { ref?: React.Ref<HTMLTableCaptionElement> }) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  );
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
