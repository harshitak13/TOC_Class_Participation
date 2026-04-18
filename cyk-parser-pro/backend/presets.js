module.exports = {
  anbn: {
    name: 'aⁿbⁿ Language',
    rules: [['S','A B'],['S','A C'],['C','S B'],['A','a'],['B','b']].map(([lhs,rhs])=>({lhs,rhs:rhs.split(' ')})),
    startSymbol: 'S', input: 'a a b b',
    description: 'Classic context-free language {aⁿbⁿ | n≥1}'
  },
  eqab: {
    name: 'Equal a,b',
    rules: [['S','A B'],['S','A C'],['C','S B'],['S','B A'],['S','B D'],['D','S A'],['A','a'],['B','b']].map(([lhs,rhs])=>({lhs,rhs:rhs.split(' ')})),
    startSymbol: 'S', input: 'a b b a',
    description: 'Strings with equal numbers of a and b'
  },
  palindrome: {
    name: 'Palindrome',
    rules: [['S','A B'],['B','S A'],['S','A'],['S','B'],['S','a'],['S','b'],['A','a'],['B','b']].map(([lhs,rhs])=>({lhs,rhs:rhs.split(' ')})),
    startSymbol: 'S', input: 'a b a',
    description: 'Even-length palindromes over {a,b}'
  },
  arith: {
    name: 'Arithmetic',
    rules: [['E','E A'],['A','P T'],['E','T'],['T','a'],['T','b'],['P','+']].map(([lhs,rhs])=>({lhs,rhs:rhs.split(' ')})),
    startSymbol: 'E', input: 'a + b',
    description: 'Simple arithmetic expressions'
  },
  ambig: {
    name: 'Ambiguous',
    rules: [['S','A B'],['S','A C'],['C','S B'],['S','B D'],['D','S A'],['S','B A'],['S','A'],['S','B'],['A','a'],['B','b']].map(([lhs,rhs])=>({lhs,rhs:rhs.split(' ')})),
    startSymbol: 'S', input: 'a b',
    description: 'Intentionally ambiguous grammar'
  },
  dyck: {
    name: 'Dyck (balanced parens)',
    rules: [['S','L R'],['L','l'],['R','r'],['S','S S'],['S','L T'],['T','S R']].map(([lhs,rhs])=>({lhs,rhs:rhs.split(' ')})),
    startSymbol: 'S', input: 'l l r r',
    description: 'Balanced parentheses (Dyck language)'
  },
  wcw: {
    name: 'ww^R',
    rules: [['S','A B'],['B','S A'],['S','a'],['S','b'],['A','a'],['B','b']].map(([lhs,rhs])=>({lhs,rhs:rhs.split(' ')})),
    startSymbol: 'S', input: 'a b b a',
    description: 'Strings of form ww^R (reverse)'
  }
};
