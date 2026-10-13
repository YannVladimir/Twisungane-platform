package com.twisungane.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.twisungane.entity.*;
import com.twisungane.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfService {

    private final SystemConfigRepository systemConfigRepository;

    private final String LOGO_PATH = "C:\\Users\\Yanba\\Desktop\\Twisungane\\Twisungane\\twisungane-logo.webp";

    public byte[] generateMemberStatement(Member m, List<ShareRecord> shares, List<Loan> loans, List<Penalty> penalties) {
        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();
            addHeader(document, "INDIVIDUAL FINANCIAL STATEMENT");

            Font bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
            document.add(new Paragraph("Member: " + m.getFirstName() + " " + m.getLastName(), bold));
            document.add(new Paragraph("National ID: " + m.getNationalId()));
            document.add(new Paragraph("Generated on: " + LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)));
            document.add(new Paragraph("\n"));

            // Shares Section
            document.add(new Paragraph("1. SHARES & CONTRIBUTIONS", bold));
            PdfPTable shareTable = new PdfPTable(3);
            shareTable.setWidthPercentage(100);
            shareTable.addCell("Date");
            shareTable.addCell("Type");
            shareTable.addCell("Amount (FRW)");
            
            BigDecimal totalShares = BigDecimal.ZERO;
            for (ShareRecord s : shares) {
                shareTable.addCell(s.getDateBought().format(DateTimeFormatter.ISO_LOCAL_DATE));
                shareTable.addCell("Share Purchase");
                shareTable.addCell(s.getAmount().toString());
                totalShares = totalShares.add(s.getAmount());
            }
            document.add(shareTable);
            document.add(new Paragraph("Total Shares Balance: " + totalShares + " FRW", bold));
            document.add(new Paragraph("\n"));

            // Loans Section
            document.add(new Paragraph("2. ACTIVE LOANS", bold));
            if (loans.isEmpty()) {
                document.add(new Paragraph("No active loans."));
            } else {
                PdfPTable loanTable = new PdfPTable(3);
                loanTable.setWidthPercentage(100);
                loanTable.addCell("ID");
                loanTable.addCell("Disbursement");
                loanTable.addCell("Balance");
                for (Loan l : loans) {
                    loanTable.addCell(l.getId().toString().substring(0, 8));
                    loanTable.addCell(l.getDisbursementDate().toString());
                    loanTable.addCell(l.getRemainingPrincipal().add(l.getRemainingInterest()).toString());
                }
                document.add(loanTable);
            }
            document.add(new Paragraph("\n"));

            document.close();
        } catch (Exception e) {
            log.error("Error generating member statement", e);
        }
        return out.toByteArray();
    }

    public byte[] generateMonthlyStatusReport(
            int month, int year,
            BigDecimal totalShares, BigDecimal totalLoans, int memberCount,
            List<Map<String, Object>> memberSharesList,
            Map<String, BigDecimal> contributionTotals,
            List<GroupExpense> expenditures) {

        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();
            addHeader(document, "MONTHLY FINANCIAL STATUS REPORT");

            Font body  = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);
            Font bold  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);
            Font hdr   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font sec   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.ACCENT);
            Font small = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.BLACK);
            Font foot  = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.DARK_GRAY);

            String monthName = java.time.Month.of(month)
                    .getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH);
            Paragraph period = new Paragraph(
                    "Period: " + monthName + " " + year + "     |     Generated: "
                    + LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.ENGLISH)),
                    body);
            period.setAlignment(Element.ALIGN_CENTER);
            document.add(period);
            document.add(new Paragraph("\n"));

            // ── SUMMARY ──────────────────────────────────────
            document.add(sectionTitle("1. ASSOCIATION SUMMARY", sec));
            PdfPTable summary = new PdfPTable(new float[]{3f, 2f});
            summary.setWidthPercentage(65);
            summary.setHorizontalAlignment(Element.ALIGN_LEFT);
            addRow(summary, bold, body, Color.LIGHT_GRAY, "Total Shares Pool", frw(totalShares));
            addRow(summary, bold, body, Color.WHITE,      "Active Loans Outstanding", frw(totalLoans));
            addRow(summary, bold, body, Color.LIGHT_GRAY, "Active Contributing Members", String.valueOf(memberCount));
            document.add(summary);
            document.add(new Paragraph("\n"));

            // ── MEMBER SHARES BREAKDOWN ───────────────────────
            document.add(sectionTitle("2. MEMBER SHARES BREAKDOWN  (Ordered by Shares — Descending)", sec));
            PdfPTable sharesTable = new PdfPTable(new float[]{0.5f, 3.5f, 1.5f, 2f});
            sharesTable.setWidthPercentage(100);
            addHeaderCells(sharesTable, hdr, "#", "Member Name", "Share Count", "Value (FRW)");

            int rank = 1;
            BigDecimal grandTotal = BigDecimal.ZERO;
            for (Map<String, Object> row : memberSharesList) {
                BigDecimal val = (BigDecimal) row.get("value");
                grandTotal = grandTotal.add(val);
                com.lowagie.text.pdf.RGBColor bg = (rank % 2 == 0) ? Color.LIGHT_GRAY : Color.WHITE;
                addDataCells(sharesTable, small, bg,
                        String.valueOf(rank),
                        (String) row.get("name"),
                        row.get("count").toString(),
                        frw(val));
                rank++;
            }
            addTotalRow(sharesTable, hdr, 3, "TOTAL", frw(grandTotal));
            document.add(sharesTable);
            document.add(new Paragraph("\n"));

            // ── CONTRIBUTIONS COLLECTED ──────────────────────
            document.add(sectionTitle("3. CONTRIBUTIONS COLLECTED — " + monthName.toUpperCase() + " " + year, sec));
            PdfPTable contribTable = new PdfPTable(new float[]{3f, 2f});
            contribTable.setWidthPercentage(65);
            contribTable.setHorizontalAlignment(Element.ALIGN_LEFT);
            addHeaderCells(contribTable, hdr, "Contribution Type", "Amount (FRW)");

            Map<String, String> typeLabels = new LinkedHashMap<>();
            typeLabels.put("SOCIAL",             "Cotisation Sociale");
            typeLabels.put("FRAIS_BANCAIRE",      "Frais Bancaires");
            typeLabels.put("OBLIGATORY_RESERVE",  "Réserve Obligatoire");
            typeLabels.put("PENALTY",             "Pénalités");

            BigDecimal totalCollected = BigDecimal.ZERO;
            int ci = 1;
            for (Map.Entry<String, String> e : typeLabels.entrySet()) {
                BigDecimal amt = contributionTotals.getOrDefault(e.getKey(), BigDecimal.ZERO);
                totalCollected = totalCollected.add(amt);
                com.lowagie.text.pdf.RGBColor bg = (ci % 2 == 0) ? Color.LIGHT_GRAY : Color.WHITE;
                addDataCells(contribTable, small, bg, e.getValue(), frw(amt));
                ci++;
            }
            addTotalRow(contribTable, hdr, 1, "TOTAL COLLECTED", frw(totalCollected));
            document.add(contribTable);
            document.add(new Paragraph("\n"));

            // ── EXPENDITURES ─────────────────────────────────
            document.add(sectionTitle("4. EXPENDITURES — " + monthName.toUpperCase() + " " + year, sec));
            if (expenditures.isEmpty()) {
                document.add(new Paragraph("No expenditures recorded for this period.", body));
            } else {
                PdfPTable expTable = new PdfPTable(new float[]{1.5f, 4f, 2f});
                expTable.setWidthPercentage(100);
                addHeaderCells(expTable, hdr, "Date", "Description", "Amount (FRW)");

                BigDecimal totalExp = BigDecimal.ZERO;
                int ei = 1;
                for (GroupExpense exp : expenditures) {
                    com.lowagie.text.pdf.RGBColor bg = (ei % 2 == 0) ? Color.LIGHT_GRAY : Color.WHITE;
                    addDataCells(expTable, small, bg,
                            exp.getDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                            exp.getDescription(),
                            frw(exp.getAmount()));
                    totalExp = totalExp.add(exp.getAmount());
                    ei++;
                }
                addTotalRow(expTable, hdr, 2, "TOTAL EXPENDITURES", frw(totalExp));
                document.add(expTable);
            }
            document.add(new Paragraph("\n"));

            // ── FOOTER ───────────────────────────────────────
            Paragraph footer = new Paragraph(
                    "This report was generated automatically by the Twisungane Digital Management System on "
                    + LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.ENGLISH)) + ".",
                    foot);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (Exception e) {
            log.error("Error generating monthly status report", e);
        }
        return out.toByteArray();
    }

    public byte[] generateAnnualAuditReport(
            int year,
            long memberCount,
            java.math.BigDecimal totalSharesPool,
            java.math.BigDecimal sharesAddedInYear,
            java.math.BigDecimal activeLoansOutstanding,
            long loansCount,
            java.math.BigDecimal totalPrincipalDisbursed,
            java.math.BigDecimal totalPrincipalRepaid,
            java.math.BigDecimal totalInterestRepaid,
            long snapshotCount,
            java.math.BigDecimal totalInterestExpected,
            java.math.BigDecimal totalInterestDistributed,
            java.util.Map<String, java.math.BigDecimal> contribsByType,
            java.math.BigDecimal totalContributions,
            java.math.BigDecimal socialPaid,
            long socialClaimsCount,
            java.util.List<GroupExpense> expenses,
            java.math.BigDecimal totalExpenses,
            java.math.BigDecimal penaltiesIssued,
            java.math.BigDecimal penaltiesCollected,
            long penaltyCount,
            java.math.BigDecimal netIncome,
            java.util.List<java.util.Map<String, Object>> memberShares) {

        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        java.util.Map<String, String> typeLabels = new LinkedHashMap<>();
        typeLabels.put("SOCIAL",            "Cotisation Sociale");
        typeLabels.put("FRAIS_BANCAIRE",     "Frais Bancaires");
        typeLabels.put("OBLIGATORY_RESERVE", "Réserve Obligatoire");
        typeLabels.put("PENALTY",            "Pénalités");

        try {
            PdfWriter.getInstance(document, out);
            document.open();
            addHeader(document, "ANNUAL AUDIT REPORT — " + year);

            Font body  = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);
            Font bold  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);
            Font hdr   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font sec   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.ACCENT);
            Font small = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.BLACK);
            Font foot  = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.DARK_GRAY);

            Paragraph generated = new Paragraph(
                    "Fiscal Year: " + year + "     |     Generated: "
                    + LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.ENGLISH)),
                    body);
            generated.setAlignment(Element.ALIGN_CENTER);
            document.add(generated);
            document.add(new Paragraph("\n"));

            // ── 1. ASSOCIATION OVERVIEW ──────────────────────────────────────
            document.add(sectionTitle("1. ASSOCIATION OVERVIEW — YEAR END " + year, sec));
            PdfPTable overview = new PdfPTable(new float[]{3.5f, 2f});
            overview.setWidthPercentage(65);
            overview.setHorizontalAlignment(Element.ALIGN_LEFT);
            addRow(overview, bold, body, Color.LIGHT_GRAY, "Active Contributing Members", String.valueOf(memberCount));
            addRow(overview, bold, body, Color.WHITE,      "Total Shares Pool (Cumulative)", frw(totalSharesPool));
            addRow(overview, bold, body, Color.LIGHT_GRAY, "New Shares Purchased in " + year, frw(sharesAddedInYear));
            addRow(overview, bold, body, Color.WHITE,      "Active Loans Outstanding (End of Year)", frw(activeLoansOutstanding));
            document.add(overview);
            document.add(new Paragraph("\n"));

            // ── 2. LOAN ACTIVITY ─────────────────────────────────────────────
            document.add(sectionTitle("2. LOAN ACTIVITY — " + year, sec));
            PdfPTable loans = new PdfPTable(new float[]{3.5f, 2f});
            loans.setWidthPercentage(65);
            loans.setHorizontalAlignment(Element.ALIGN_LEFT);
            addRow(loans, bold, body, Color.LIGHT_GRAY, "Loans Disbursed",             String.valueOf(loansCount));
            addRow(loans, bold, body, Color.WHITE,      "Total Principal Disbursed",   frw(totalPrincipalDisbursed));
            addRow(loans, bold, body, Color.LIGHT_GRAY, "Principal Collected (Repayments)", frw(totalPrincipalRepaid));
            addRow(loans, bold, body, Color.WHITE,      "Interest Collected",          frw(totalInterestRepaid));
            document.add(loans);
            document.add(new Paragraph("\n"));

            // ── 3. INTEREST DISTRIBUTION ────────────────────────────────────
            document.add(sectionTitle("3. INTEREST DISTRIBUTION — " + year, sec));
            PdfPTable interest = new PdfPTable(new float[]{3.5f, 2f});
            interest.setWidthPercentage(65);
            interest.setHorizontalAlignment(Element.ALIGN_LEFT);
            addRow(interest, bold, body, Color.LIGHT_GRAY, "Interest Snapshots Taken",   String.valueOf(snapshotCount));
            addRow(interest, bold, body, Color.WHITE,      "Total Interest Expected",    frw(totalInterestExpected));
            addRow(interest, bold, body, Color.LIGHT_GRAY, "Total Interest Distributed", frw(totalInterestDistributed));
            addRow(interest, bold, body, Color.WHITE,      "Pending Distribution",
                    frw(totalInterestExpected.subtract(totalInterestDistributed).max(java.math.BigDecimal.ZERO)));
            document.add(interest);
            document.add(new Paragraph("\n"));

            // ── 4. CONTRIBUTIONS COLLECTED ───────────────────────────────────
            document.add(sectionTitle("4. CONTRIBUTIONS COLLECTED — " + year, sec));
            PdfPTable contribs = new PdfPTable(new float[]{3f, 2f});
            contribs.setWidthPercentage(65);
            contribs.setHorizontalAlignment(Element.ALIGN_LEFT);
            addHeaderCells(contribs, hdr, "Contribution Type", "Amount (FRW)");
            int ci = 1;
            for (java.util.Map.Entry<String, java.math.BigDecimal> e : contribsByType.entrySet()) {
                String label = typeLabels.getOrDefault(e.getKey(), e.getKey());
                com.lowagie.text.pdf.RGBColor bg = (ci % 2 == 0) ? Color.LIGHT_GRAY : Color.WHITE;
                addDataCells(contribs, small, bg, label, frw(e.getValue()));
                ci++;
            }
            addTotalRow(contribs, hdr, 1, "TOTAL CONTRIBUTIONS", frw(totalContributions));
            document.add(contribs);
            document.add(new Paragraph("\n"));

            // ── 5. SOCIAL FUND ───────────────────────────────────────────────
            document.add(sectionTitle("5. SOCIAL FUND ACTIVITY — " + year, sec));
            PdfPTable social = new PdfPTable(new float[]{3.5f, 2f});
            social.setWidthPercentage(65);
            social.setHorizontalAlignment(Element.ALIGN_LEFT);
            addRow(social, bold, body, Color.LIGHT_GRAY, "Claims Settled",    String.valueOf(socialClaimsCount));
            addRow(social, bold, body, Color.WHITE,      "Total Amount Paid", frw(socialPaid));
            document.add(social);
            document.add(new Paragraph("\n"));

            // ── 6. GROUP EXPENDITURES ────────────────────────────────────────
            document.add(sectionTitle("6. GROUP EXPENDITURES — " + year, sec));
            if (expenses.isEmpty()) {
                document.add(new Paragraph("No expenditures recorded for " + year + ".", body));
            } else {
                PdfPTable expTable = new PdfPTable(new float[]{1.5f, 4f, 2f});
                expTable.setWidthPercentage(100);
                addHeaderCells(expTable, hdr, "Date", "Description", "Amount (FRW)");
                int ei = 1;
                for (GroupExpense exp : expenses) {
                    com.lowagie.text.pdf.RGBColor bg = (ei % 2 == 0) ? Color.LIGHT_GRAY : Color.WHITE;
                    addDataCells(expTable, small, bg,
                            exp.getDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                            exp.getDescription(),
                            frw(exp.getAmount()));
                    ei++;
                }
                addTotalRow(expTable, hdr, 2, "TOTAL EXPENDITURES", frw(totalExpenses));
                document.add(expTable);
            }
            document.add(new Paragraph("\n"));

            // ── 7. PENALTIES ─────────────────────────────────────────────────
            document.add(sectionTitle("7. PENALTY ACTIVITY — " + year, sec));
            PdfPTable pen = new PdfPTable(new float[]{3.5f, 2f});
            pen.setWidthPercentage(65);
            pen.setHorizontalAlignment(Element.ALIGN_LEFT);
            addRow(pen, bold, body, Color.LIGHT_GRAY, "Penalties Issued",    String.valueOf(penaltyCount));
            addRow(pen, bold, body, Color.WHITE,      "Total Value Issued",  frw(penaltiesIssued));
            addRow(pen, bold, body, Color.LIGHT_GRAY, "Total Collected",     frw(penaltiesCollected));
            document.add(pen);
            document.add(new Paragraph("\n"));

            // ── 8. NET INCOME POSITION ───────────────────────────────────────
            document.add(sectionTitle("8. NET INCOME POSITION — " + year, sec));
            PdfPTable net = new PdfPTable(new float[]{3.5f, 2f});
            net.setWidthPercentage(65);
            net.setHorizontalAlignment(Element.ALIGN_LEFT);
            addRow(net, bold, body, Color.LIGHT_GRAY, "(+) Interest Collected",      frw(totalInterestRepaid));
            addRow(net, bold, body, Color.WHITE,      "(+) Contributions Collected", frw(totalContributions));
            addRow(net, bold, body, Color.LIGHT_GRAY, "(-) Social Fund Payouts",     frw(socialPaid));
            addRow(net, bold, body, Color.WHITE,      "(-) Group Expenditures",      frw(totalExpenses));
            addTotalRow(net, hdr, 1, "NET INCOME / (DEFICIT)", frw(netIncome));
            document.add(net);
            document.add(new Paragraph("\n"));

            // ── 9. MEMBER SHARES STANDINGS ───────────────────────────────────
            document.add(sectionTitle("9. MEMBER SHARES STANDINGS (AS AT 31 DEC " + year + ")", sec));
            PdfPTable mTable = new PdfPTable(new float[]{0.5f, 4f, 2.5f, 2f});
            mTable.setWidthPercentage(100);
            addHeaderCells(mTable, hdr, "#", "Member Name", "Total Shares (FRW)", "Active Loan");
            int rank = 1;
            for (java.util.Map<String, Object> m : memberShares) {
                com.lowagie.text.pdf.RGBColor bg = (rank % 2 == 0) ? Color.LIGHT_GRAY : Color.WHITE;
                java.math.BigDecimal lb = (java.math.BigDecimal) m.get("loanBalance");
                addDataCells(mTable, small, bg,
                        String.valueOf(rank),
                        (String) m.get("name"),
                        frw((java.math.BigDecimal) m.get("shares")),
                        lb != null && lb.compareTo(java.math.BigDecimal.ZERO) > 0 ? frw(lb) : "—");
                rank++;
            }
            document.add(mTable);
            document.add(new Paragraph("\n\n"));

            // ── FOOTER ───────────────────────────────────────────────────────
            Paragraph footer = new Paragraph(
                    "This Annual Audit Report was generated automatically by the Twisungane Digital Management System on "
                    + LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.ENGLISH))
                    + ". For General Assembly use only.",
                    foot);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (Exception e) {
            log.error("Error generating annual audit report", e);
        }
        return out.toByteArray();
    }

    public byte[] generateContributionReceipt(com.twisungane.entity.Contribution c) {
        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(document, out);
            document.open();
            addHeader(document, "CONTRIBUTION RECEIPT");

            Font body  = FontFactory.getFont(FontFactory.HELVETICA, 11, Color.BLACK);
            Font bold  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.BLACK);
            Font hdr   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font small = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            Paragraph ref = new Paragraph("Receipt ID: " + c.getId().toString(), body);
            ref.setAlignment(Element.ALIGN_RIGHT);
            document.add(ref);
            document.add(new Paragraph("Generated: " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.ENGLISH)), body));
            document.add(new Paragraph("\n"));

            PdfPTable table = new PdfPTable(new float[]{2.5f, 3.5f});
            table.setWidthPercentage(70);
            table.setHorizontalAlignment(Element.ALIGN_LEFT);

            addRow(table, bold, small, Color.LIGHT_GRAY,
                    "Member", c.getMember().getFirstName() + " " + c.getMember().getLastName());
            addRow(table, bold, small, Color.WHITE,
                    "Amount", frw(c.getAmount()));
            addRow(table, bold, small, Color.LIGHT_GRAY,
                    "Type", c.getType().name().replace("_", " "));
            addRow(table, bold, small, Color.WHITE,
                    "Period", java.time.Month.of(c.getMonth()).getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH) + " " + c.getYear());
            addRow(table, bold, small, Color.LIGHT_GRAY,
                    "Date Paid", c.getDatePaid().format(DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.ENGLISH)));
            if (c.getDetails() != null && !c.getDetails().isBlank()) {
                addRow(table, bold, small, Color.WHITE, "Details", c.getDetails());
            }
            document.add(table);
            document.add(new Paragraph("\n"));

            Paragraph footer = new Paragraph(
                    "This receipt was generated automatically by the Twisungane Digital Management System.",
                    FontFactory.getFont(FontFactory.HELVETICA, 8, Color.DARK_GRAY));
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (Exception e) {
            log.error("Error generating contribution receipt", e);
        }
        return out.toByteArray();
    }

    // ── PDF helpers ──────────────────────────────────────────────────────────

    private Paragraph sectionTitle(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setSpacingBefore(10);
        p.setSpacingAfter(5);
        return p;
    }

    private String frw(BigDecimal amount) {
        if (amount == null) return "0 FRW";
        return String.format(java.util.Locale.US, "%,.0f FRW", amount.doubleValue());
    }

    private void addHeaderCells(PdfPTable table, Font font, String... headers) {
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, font));
            cell.setBackgroundColor(Color.HEADER_BG);
            cell.setPadding(6);
            table.addCell(cell);
        }
    }

    private void addDataCells(PdfPTable table, Font font, com.lowagie.text.pdf.RGBColor bg, String... values) {
        for (String v : values) {
            PdfPCell cell = new PdfPCell(new Phrase(v != null ? v : "", font));
            cell.setBackgroundColor(bg);
            cell.setPadding(5);
            table.addCell(cell);
        }
    }

    private void addTotalRow(PdfPTable table, Font font, int labelColspan, String label, String value) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
        labelCell.setColspan(labelColspan);
        labelCell.setPadding(6);
        labelCell.setBackgroundColor(Color.HEADER_BG);
        table.addCell(labelCell);
        PdfPCell valueCell = new PdfPCell(new Phrase(value, font));
        valueCell.setPadding(6);
        valueCell.setBackgroundColor(Color.HEADER_BG);
        table.addCell(valueCell);
    }

    private void addRow(PdfPTable table, Font labelFont, Font valueFont,
                        com.lowagie.text.pdf.RGBColor bg, String label, String value) {
        PdfPCell lc = new PdfPCell(new Phrase(label, labelFont));
        lc.setPadding(6); lc.setBackgroundColor(bg);
        PdfPCell vc = new PdfPCell(new Phrase(value, valueFont));
        vc.setPadding(6); vc.setBackgroundColor(bg);
        table.addCell(lc);
        table.addCell(vc);
    }

    private void addHeader(Document document, String titleStr) throws Exception {
        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
        
        try {
            Image logo = Image.getInstance(LOGO_PATH);
            logo.setAlignment(Element.ALIGN_CENTER);
            logo.scaleToFit(80, 80);
            document.add(logo);
        } catch (Exception e) {}

        Paragraph title = new Paragraph(titleStr, titleFont);
        title.setAlignment(Element.ALIGN_CENTER);
        document.add(title);
        document.add(new Paragraph("\n"));
    }

    public byte[] generateLoanContract(Loan loan) {
        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Font styles
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 12, Color.BLACK);
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.BLACK);

            // Add Logo if exists (Simplified for now, WebP might need extra handling)
            try {
                Image logo = Image.getInstance(LOGO_PATH);
                logo.setAlignment(Element.ALIGN_CENTER);
                logo.scaleToFit(100, 100);
                document.add(logo);
            } catch (Exception e) {
                // Skip logo if error
                Paragraph placeholder = new Paragraph("TWISUNGANE ASSOCIATION", subTitleFont);
                placeholder.setAlignment(Element.ALIGN_CENTER);
                document.add(placeholder);
            }

            document.add(new Paragraph("\n"));
            
            Paragraph title = new Paragraph("LOAN AGREEMENT / AMASEZERANO Y'INGURANE", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);
            
            document.add(new Paragraph("\n"));
            
            Member m = loan.getMember();
            
            Paragraph intro = new Paragraph(
                "This agreement is made between TWISUNGANE Association and the member:",
                bodyFont
            );
            document.add(intro);
            document.add(new Paragraph("\n"));

            // Member Details Table
            com.lowagie.text.pdf.PdfPTable table = new com.lowagie.text.pdf.PdfPTable(2);
            table.setWidthPercentage(100);
            table.addCell("Member Name:");
            table.addCell(m.getFirstName() + " " + m.getLastName());
            table.addCell("National ID:");
            table.addCell(m.getNationalId());
            table.addCell("Loan Amount:");
            table.addCell(loan.getPrincipalAmount().toString() + " FRW");
            table.addCell("Disbursement Date:");
            table.addCell(loan.getDisbursementDate().format(DateTimeFormatter.ISO_LOCAL_DATE));
            String installmentDisplay = systemConfigRepository.findByConfigKey("STANDARD_INSTALLMENT")
                    .map(c -> String.format("%,d", new java.math.BigDecimal(c.getConfigValue()).longValue()))
                    .orElse("55,000");
            table.addCell("Monthly Installment:");
            table.addCell(installmentDisplay + " FRW");

            document.add(table);
            document.add(new Paragraph("\n"));

            Paragraph terms = new Paragraph("Terms and Conditions:", subTitleFont);
            document.add(terms);

            document.add(new Paragraph("1. The borrower agrees to pay a fixed installment of " + installmentDisplay + " FRW every month."));
            document.add(new Paragraph("2. This amount consists of Principal and 10% interest."));
            document.add(new Paragraph("3. Overpayments are credited as pre-payments for future installments."));
            document.add(new Paragraph("4. Failure to pay for 3 consecutive months will lead to General Assembly escalation."));

            document.add(new Paragraph("\n\n\n"));
            
            Paragraph signatures = new Paragraph("Signatures:", boldFont);
            document.add(signatures);
            document.add(new Paragraph("\n"));
            document.add(new Paragraph("Borrower: __________________________        President: __________________________"));

            document.close();
        } catch (Exception e) {
            log.error("Error generating loan contract", e);
        }

        return out.toByteArray();
    }

    private static class Color {
        static final com.lowagie.text.pdf.RGBColor BLACK      = new com.lowagie.text.pdf.RGBColor(0, 0, 0);
        static final com.lowagie.text.pdf.RGBColor WHITE      = new com.lowagie.text.pdf.RGBColor(255, 255, 255);
        static final com.lowagie.text.pdf.RGBColor DARK_GRAY  = new com.lowagie.text.pdf.RGBColor(64, 64, 64);
        static final com.lowagie.text.pdf.RGBColor HEADER_BG  = new com.lowagie.text.pdf.RGBColor(15, 23, 42);
        static final com.lowagie.text.pdf.RGBColor ACCENT     = new com.lowagie.text.pdf.RGBColor(161, 105, 0);
        static final com.lowagie.text.pdf.RGBColor LIGHT_GRAY = new com.lowagie.text.pdf.RGBColor(245, 245, 245);
    }
}
