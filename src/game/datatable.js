//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 데이터 테이블 로더 재사용 유틸.
//
// 로컬라이제이션, 스테이지 같은 게임 데이터 테이블(JSON)을 번들에 인라인하지 않고
// 런타임에 fetch 로 로드할 때 씁니다. cache: "no-cache" 로 서버와 재검증하므로
// 배포 후 브라우저가 옛 테이블을 계속 쓰는 문제를 막습니다.
//
// 권장 사용 패턴.
//   1. 씬 load() 에서 const table = await loadDataTable("./assets/data/xxx.json");
//   2. table 이 null 이면 로드 실패, 기본값으로 동작하거나 로드를 재시도합니다.
//==============================================================================


//==============================================================================
// 데이터 테이블 로드. 실패 시 null 반환.
//==============================================================================
/**
 * @param { string } url
 * @returns { Promise<object> }
 */
export async function loadDataTable(url) {
	try {
		const response = await System.window.fetch(url, { cache: "no-cache" });
		if (!response.ok) {
			return null;
		}
		const table = await response.json();
		return table;
	}
	catch (error) {
		console.error(error);
		return null;
	}
}
