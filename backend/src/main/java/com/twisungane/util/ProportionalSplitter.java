package com.twisungane.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Splits a fixed total amount proportionally across a set of weights so the individually
 * rounded shares always sum EXACTLY to the total (largest-remainder / Hamilton apportionment
 * method), instead of each share being rounded independently and drifting from the total.
 */
public class ProportionalSplitter {

    private static final BigDecimal CENT = new BigDecimal("0.01");

    public static List<BigDecimal> splitExactly(BigDecimal total, List<BigDecimal> weights) {
        int n = weights.size();
        List<BigDecimal> result = new ArrayList<>(n);

        BigDecimal totalWeight = BigDecimal.ZERO;
        for (BigDecimal w : weights) totalWeight = totalWeight.add(w);

        BigDecimal targetTotal = total.setScale(2, RoundingMode.HALF_UP);

        if (totalWeight.compareTo(BigDecimal.ZERO) <= 0) {
            for (int i = 0; i < n; i++) result.add(BigDecimal.ZERO.setScale(2));
            return result;
        }

        BigDecimal[] exact = new BigDecimal[n];
        BigDecimal[] floor = new BigDecimal[n];
        BigDecimal[] remainder = new BigDecimal[n];
        BigDecimal sumFloor = BigDecimal.ZERO;

        for (int i = 0; i < n; i++) {
            exact[i] = total.multiply(weights.get(i)).divide(totalWeight, 10, RoundingMode.HALF_UP);
            floor[i] = exact[i].setScale(2, RoundingMode.FLOOR);
            remainder[i] = exact[i].subtract(floor[i]);
            sumFloor = sumFloor.add(floor[i]);
        }

        BigDecimal leftover = targetTotal.subtract(sumFloor);
        int cents = leftover.movePointRight(2).setScale(0, RoundingMode.HALF_UP).intValue();

        Integer[] order = new Integer[n];
        for (int i = 0; i < n; i++) order[i] = i;
        Arrays.sort(order, (a, b) -> remainder[b].compareTo(remainder[a]));

        BigDecimal[] finalAmount = floor.clone();
        if (cents >= 0) {
            for (int i = 0; i < cents; i++) {
                finalAmount[order[i % n]] = finalAmount[order[i % n]].add(CENT);
            }
        } else {
            for (int i = 0; i < -cents; i++) {
                finalAmount[order[n - 1 - (i % n)]] = finalAmount[order[n - 1 - (i % n)]].subtract(CENT);
            }
        }

        result.addAll(Arrays.asList(finalAmount));
        return result;
    }
}
