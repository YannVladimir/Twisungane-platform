package com.twisungane.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ProportionalSplitter drives real money: it is how loan interest gets divided among members
 * at a snapshot (see LoanService.createInterestSnapshot / distributeInterestToSnapshotMembers).
 * The one invariant that must always hold is that the individually-rounded shares sum back to
 * EXACTLY the original total — a naive "round each share independently" implementation would
 * drift by a few cents and silently lose or fabricate money across thousands of snapshots.
 */
class ProportionalSplitterTest {

    @Test
    void splitsSumsExactlyToTheOriginalTotal_evenWeights() {
        BigDecimal total = new BigDecimal("1000.00");
        List<BigDecimal> weights = List.of(
                new BigDecimal("1"), new BigDecimal("1"), new BigDecimal("1")
        );

        List<BigDecimal> shares = ProportionalSplitter.splitExactly(total, weights);

        BigDecimal sum = shares.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, total.compareTo(sum), "Shares must sum exactly to the total, not drift due to rounding");
        assertEquals(3, shares.size());
    }

    @Test
    void splitsSumsExactlyToTheOriginalTotal_unevenWeightsThatDontDivideCleanly() {
        // 100 split 3 ways is the classic case that breaks naive division: 33.33/33.33/33.33 != 100.00
        BigDecimal total = new BigDecimal("100.00");
        List<BigDecimal> weights = List.of(
                new BigDecimal("1"), new BigDecimal("1"), new BigDecimal("1")
        );

        List<BigDecimal> shares = ProportionalSplitter.splitExactly(total, weights);

        BigDecimal sum = shares.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, total.compareTo(sum));
    }

    @Test
    void largerWeightReceivesAtLeastAsMuchAsSmallerWeight() {
        BigDecimal total = new BigDecimal("900.00");
        List<BigDecimal> weights = List.of(
                new BigDecimal("500000"), // big share holder
                new BigDecimal("50000")   // small share holder
        );

        List<BigDecimal> shares = ProportionalSplitter.splitExactly(total, weights);

        assertTrue(shares.get(0).compareTo(shares.get(1)) > 0,
                "The member with 10x the weight should receive more of the split");
        BigDecimal sum = shares.get(0).add(shares.get(1));
        assertEquals(0, total.compareTo(sum));
    }

    @Test
    void zeroTotalWeightReturnsAllZeros() {
        BigDecimal total = new BigDecimal("500.00");
        List<BigDecimal> weights = List.of(BigDecimal.ZERO, BigDecimal.ZERO);

        List<BigDecimal> shares = ProportionalSplitter.splitExactly(total, weights);

        assertEquals(0, BigDecimal.ZERO.setScale(2).compareTo(shares.get(0)));
        assertEquals(0, BigDecimal.ZERO.setScale(2).compareTo(shares.get(1)));
    }

    @Test
    void singleMemberReceivesTheFullAmount() {
        BigDecimal total = new BigDecimal("12345.67");
        List<BigDecimal> weights = List.of(new BigDecimal("1"));

        List<BigDecimal> shares = ProportionalSplitter.splitExactly(total, weights);

        assertEquals(0, total.compareTo(shares.get(0)));
    }

    @Test
    void manyMembersWithOddRemainderStillSumExactly() {
        // 11 members splitting an amount that doesn't divide evenly by 11 — a realistic
        // interest-distribution scenario across an association's membership.
        BigDecimal total = new BigDecimal("1000.01");
        List<BigDecimal> weights = new java.util.ArrayList<>();
        for (int i = 0; i < 11; i++) weights.add(new BigDecimal("100000"));

        List<BigDecimal> shares = ProportionalSplitter.splitExactly(total, weights);

        BigDecimal sum = shares.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, total.compareTo(sum));
        assertEquals(11, shares.size());
    }
}
