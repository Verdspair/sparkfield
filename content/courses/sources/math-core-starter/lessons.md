---
question_id: MATH_Q04
family_id: FAM_MATH_Q04
subject: math
knowledge_node: MATH_N1_SET_FUNC
step_role: resource_check
question_type: single_choice
assessment_kind: retrieval
allow_material_review: false
material_md: '- $A\cap B$：同时属于两集合；$A\cup B$：至少属于其中一个。

  - $\complement_U A$：属于 $U$ 但不属于 $A$。'
answer_spec: C
partial_rubric: ''
hint_md: ''
explanation_md: $\complement_U A=\{3,4\}$，与 $B=\{2,3\}$ 的交集为 $\{3\}$。
difficulty: 2
weight: 10
est_seconds: 45
source_license: CC0-1.0
options:
  A: $\{2\}$
  B: $\{1,2,3\}$
  C: $\{3\}$
  D: $\{3,4\}$
---
已知全集 $U=\{1,2,3,4\}$，$A=\{1,2\}$，$B=\{2,3\}$，则 $(\complement_U A)\cap B=$

---
question_id: MATH_Q08
family_id: FAM_MATH_Q08
subject: math
knowledge_node: MATH_N1_SET_FUNC
step_role: verification
question_type: multi_step_numeric
assessment_kind: application
allow_material_review: false
material_md: '- $f(x)=a(x-h)^2+k$ 的对称轴为 $x=h$。

  - 闭区间最值：比较区间内的顶点值与两个端点值。'
answer_spec: min=2;max=6
partial_rubric: step_shares
hint_md: ''
explanation_md: $f(x)=(x-1)^2+2$。顶点在区间内，最小值为 $2$；端点值 $f(-1)=6$、$f(2)=3$，最大值为 $6$。
difficulty: 3
weight: 15
est_seconds: 80
source_license: CC0-1.0
steps_rubric:
- step_id: min
  prompt: 最小值
  expected: 2
  tolerance: 0
  weight_share: 0.5
- step_id: max
  prompt: 最大值
  expected: 6
  tolerance: 0
  weight_share: 0.5
---
已知 $f(x)=x^2-2x+3$，$x\in[-1,2]$。分别求 $f(x)$ 的最小值与最大值。

请写出必要的推导过程，并填写各问结果。

---
question_id: MATH_Q16
family_id: FAM_MATH_Q16
subject: math
knowledge_node: MATH_N2_TRIG_SEQ
step_role: verification
question_type: multi_step_numeric
assessment_kind: application
allow_material_review: false
material_md: '- 等差数列：$a_n=a_1+(n-1)d$。

  - $S_n=\frac{n(a_1+a_n)}{2}$；$a_k+a_{n+1-k}=a_1+a_n$。'
answer_spec: d=2;a8=17;s8=80
partial_rubric: step_shares
hint_md: ''
explanation_md: $3d=a_5-a_2=6$，得 $d=2$、$a_1=3$；$a_8=3+7\times2=17$；$S_8=\frac{8(3+17)}2=80$。
difficulty: 3
weight: 15
est_seconds: 110
source_license: CC0-1.0
steps_rubric:
- step_id: d
  prompt: （1）公差 $d$
  expected: 2
  tolerance: 0
  weight_share: 0.25
- step_id: a8
  prompt: （1）第 $8$ 项 $a_8$
  expected: 17
  tolerance: 0
  weight_share: 0.25
- step_id: s8
  prompt: （2）前 $8$ 项和 $S_8$
  expected: 80
  tolerance: 0
  weight_share: 0.5
---
等差数列 $\{a_n\}$ 满足 $a_2=5$，$a_5=11$。

（1）求公差 $d$ 与 $a_8$；（2）求前 $8$ 项和 $S_8$。

请写出必要的推导过程，并填写各问结果。

---
question_id: MATH_Q22
family_id: FAM_MATH_Q22
subject: math
knowledge_node: MATH_N3_VEC_GEOM_PROB
step_role: resource_check
question_type: multi_step_numeric
assessment_kind: application
allow_material_review: true
material_md: '- $(x-a)^2+(y-b)^2=r^2$ 的圆心为 $(a,b)$，半径为 $r$。

  - 一般方程先配方；直线与圆相切时，圆心到直线距离等于半径。'
answer_spec: cx=2;cy=-1;r=3;c=13
partial_rubric: step_shares
hint_md: ''
explanation_md: 配方得 $(x-2)^2+(y+1)^2=9$，圆心 $(2,-1)$、半径 $3$。相切有 $\frac{|c+2|}{5}=3$，结合 $c>0$ 得 $c=13$。
difficulty: 3
weight: 15
est_seconds: 130
source_license: CC0-1.0
steps_rubric:
- step_id: cx
  prompt: （1）圆心横坐标
  expected: 2
  tolerance: 0
  weight_share: 0.2
- step_id: cy
  prompt: （1）圆心纵坐标
  expected: -1
  tolerance: 0
  weight_share: 0.2
- step_id: r
  prompt: （1）半径
  expected: 3
  tolerance: 0
  weight_share: 0.2
- step_id: c
  prompt: （2）参数 $c$
  expected: 13
  tolerance: 0
  weight_share: 0.4
---
已知圆 $C:x^2+y^2-4x+2y-4=0$。

（1）求圆心坐标及半径；（2）若直线 $3x+4y+c=0\ (c>0)$ 与圆 $C$ 相切，求 $c$。

请写出必要的推导过程，并填写各问结果。

---
question_id: MATH_Q23
family_id: FAM_MATH_Q23
subject: math
knowledge_node: MATH_N3_VEC_GEOM_PROB
step_role: verification
question_type: multi_step_numeric
assessment_kind: application
allow_material_review: false
material_md: '- 样本平均数：$\bar x=\frac1n\sum_{i=1}^n x_i$。

  - 本题标准差：$s=\sqrt{\frac1n\sum_{i=1}^n(x_i-\bar x)^2}$。'
answer_spec: mean=4;variance=4.4;std=2.1
partial_rubric: step_shares
hint_md: ''
explanation_md: $\bar x=\frac{2+3+3+4+8}{5}=4$；$s^2=\frac{4+1+1+0+16}{5}=4.4$；$s=\sqrt{4.4}\approx2.10$。
difficulty: 2
weight: 15
est_seconds: 110
source_license: CC0-1.0
steps_rubric:
- step_id: mean
  prompt: 平均数
  expected: 4
  tolerance: 0
  weight_share: 0.3
- step_id: variance
  prompt: 方差（中间结果）
  expected: 4.4
  tolerance: 0.0001
  weight_share: 0.3
- step_id: std
  prompt: 标准差（保留两位小数）
  expected: 2.1
  tolerance: 1.0e-05
  weight_share: 0.4
---
样本数据为 $2,3,3,4,8$。求平均数 $\bar x$、方差 $s^2$ 与标准差 $s$。本题方差按除以 $n$ 计算；标准差保留两位小数。请写出必要的计算过程，并填写各问结果。
