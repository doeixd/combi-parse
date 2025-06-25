


function str<S extends string>(s: S) {
  return s as S
}

let s = str('s')