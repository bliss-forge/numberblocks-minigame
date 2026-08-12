import asyncio
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1] / "assets" / "audio" / "voice"
KO_VOICE = "ko-KR-SunHiNeural"
EN_VOICE = "en-GB-SoniaNeural"

KO_PROMPTS = {
    "prompt-count": "블록이 몇 개일까요?",
    "prompt-add": "두 친구가 합치면 몇이 될까요?",
    "prompt-sub": "큰 수에서 작은 수를 빼면 몇이 될까요?",
    "prompt-mul": "블록판에는 모두 몇 개가 있을까요?",
}
EN_PROMPTS = {
    "prompt-sub": "What do you get when you take the smaller number away from the larger number?",
}
KO_SAFETY = {
    "safety-next-2": "두 친구를 만나러 어린이집으로 가 볼까요?",
    "safety-next-3": "이번에는 세 친구가 있는 상가로 가요.",
    "safety-next-4": "네 친구가 길가에서 기다리고 있어요.",
    "safety-next-5": "다섯 친구를 만나러 공원으로 가요.",
    "safety-next-6": "여섯 친구가 버스 정류장에서 기다려요.",
    "safety-next-7": "일곱 친구를 만나러 도서관으로 가요.",
    "safety-next-8": "여덟 친구를 만나러 안전한 길로 돌아가요.",
    "safety-next-9": "아홉 친구가 횡단보도 근처에 있어요.",
    "safety-next-10": "열 친구를 만나러 학교 앞으로 가요.",
    "safety-red-light": "빨간불이에요. 초록불이 될 때까지 기다려요!",
    "safety-manhole": "열린 맨홀이에요. 가까이 가지 말고 돌아가요!",
    "safety-construction": "공사 중이에요. 안전 울타리 밖으로 돌아가요!",
    "safety-scooter": "길에 놓인 킥보드예요. 부딪히지 않게 돌아가요!",
    "safety-bicycle": "자전거가 지나가요. 멈추고 지나간 뒤 움직여요!",
    "safety-car": "자동차가 지나가요. 안전한 곳에서 기다려요!",
    "safety-wrong-order": "반가운 친구예요. 하지만 순서대로 만나러 가요!",
    "safety-finish": "친구들을 모두 만났어요! 안전하게 도착했어요!",
    "safety-look-both": "멈춰요, 왼쪽 오른쪽을 봐요!",
    "safety-tour": "학교까지 안전하게 가 보자!",
    "safety-take-the-bus": "여기는 버스를 타고 건너요! 정류장으로 가요.",
}
EN_SAFETY = {
    "safety-next-2": "Let's visit Numberblock Two at the nursery.",
    "safety-next-3": "Now let's find Numberblock Three by the shops.",
    "safety-next-4": "Numberblock Four is waiting beside the road.",
    "safety-next-5": "Let's visit Numberblock Five in the park.",
    "safety-next-6": "Numberblock Six is waiting at the bus stop.",
    "safety-next-7": "Let's find Numberblock Seven at the library.",
    "safety-next-8": "Let's take the safe way to Numberblock Eight.",
    "safety-next-9": "Numberblock Nine is near the crossing.",
    "safety-next-10": "Let's find Numberblock Ten by the school.",
    "safety-red-light": "The light is red. Wait until it turns green!",
    "safety-manhole": "That manhole is open. Keep away and go around it!",
    "safety-construction": "There are roadworks ahead. Stay outside the safety barrier!",
    "safety-scooter": "There is a scooter in the way. Go around it carefully!",
    "safety-bicycle": "A bicycle is passing. Stop, wait, and then move!",
    "safety-car": "A car is passing. Wait somewhere safe!",
    "safety-wrong-order": "Hello, friend! Let's meet everyone in number order.",
    "safety-finish": "We met all our friends and arrived safely!",
    "safety-look-both": "Stop! Look left and right!",
    "safety-tour": "Let's walk safely to school!",
    "safety-take-the-bus": "We cross here by bus! Let's go to the bus stop.",
}
KO_SRT = {
    "srt-arrive": "수서역에 도착하였어요!",
    "srt-board": "SRT를 타고 할아버지 할머니댁에 가요!",
    "srt-seat": "내 자리를 찾아 앉아보아요!",
    "srt-wrong-seat": "여기는 내 자리가 아니에요. 자리 번호를 다시 봐요!",
    "srt-depart": "좌석을 찾았어요! 출발합니다. 부산역에서 내려요!",
    "srt-station-dongtan": "동탄역이에요. 우리가 내릴 역인지 확인해요!",
    "srt-station-daejeon": "대전역이에요. 우리가 내릴 역인지 확인해요!",
    "srt-station-daegu": "대구역이에요. 우리가 내릴 역인지 확인해요!",
    "srt-station-busan": "부산역이에요! 여기서 내려요!",
    "srt-wrong-station": "해당 역이 아니에요. 다시 기차에 올라타야 해요!",
    "srt-parking": "할아버지 할머니 차를 찾아보아요. 그림자 모양과 번호가 같은 차예요!",
    "srt-wrong-car": "이 차가 아니에요. 모양과 번호판을 다시 봐요!",
    "srt-grandparents": "할아버지 할머니를 만났어요! 정말 잘했어요!",
}
EN_SRT = {
    "srt-arrive": "We have arrived at Suseo Station!",
    "srt-board": "Let's ride the SRT to Grandma and Grandpa's house!",
    "srt-seat": "Let's find my seat and sit down!",
    "srt-wrong-seat": "This is not my seat. Check the seat number again!",
    "srt-depart": "We found our seat! Off we go. We get off at Busan Station!",
    "srt-station-dongtan": "This is Dongtan Station. Is this our stop?",
    "srt-station-daejeon": "This is Daejeon Station. Is this our stop?",
    "srt-station-daegu": "This is Daegu Station. Is this our stop?",
    "srt-station-busan": "This is Busan Station! Time to get off!",
    "srt-wrong-station": "This is not our station. Hop back on the train!",
    "srt-parking": "Let's find Grandma and Grandpa's car. Match the shadow and the number plate!",
    "srt-wrong-car": "That is not the car. Look at the shape and the number plate again!",
    "srt-grandparents": "We met Grandma and Grandpa! Well done!",
}
KO_SUBWAY = {
    "subway-board": "지하철을 탔어요! 출발해요!",
    "subway-wrong-line": "그 호선이 아니에요. 번호를 잘 보고 기다려요!",
    "subway-stop-check": "역에 도착했어요. 내릴 역이에요!",
    "subway-wrong-stop": "여기가 아니에요. 조금 더 가요!",
    "subway-transfer": "갈아타는 역이에요! 다음 열차를 찾아요!",
    "subway-arrive": "목적지에 도착했어요! 정말 잘했어요!",
    "subway-mind-gap": "발빠짐 주의! 조심히 내려요!",
    "subway-place-zoo": "동물원에 가요!",
    "subway-place-lunapark": "놀이공원에 가요!",
    "subway-place-baseball": "야구장에 가요!",
    "subway-place-palace": "경복궁에 가요!",
    "subway-place-namsan": "남산타워에 가요!",
    "subway-place-hanriver": "한강공원에 가요!",
    "subway-place-skypark": "하늘공원에 가요!",
    "subway-place-childpark": "어린이대공원에 가요!",
    "subway-place-lake": "석촌호수에 가요!",
    "subway-place-assembly": "국회의사당에 가요!",
    # 실음원이 없는 역 4곳 — 실제 안내방송과 같은 형식으로 읽는다
    "subway-station-moran": "이번 역은 모란역입니다.",
    "subway-station-gayang": "이번 역은 가양역입니다.",
    "subway-station-assembly": "이번 역은 국회의사당역입니다.",
    "subway-station-bongeunsa": "이번 역은 봉은사역입니다.",
}
EN_SUBWAY = {
    "subway-board": "We are on the subway! Off we go!",
    "subway-wrong-line": "That is not our line. Check the number and wait!",
    "subway-stop-check": "We have arrived. This is our stop!",
    "subway-wrong-stop": "Not this station. A little further!",
    "subway-transfer": "This is our transfer station! Find the next train!",
    "subway-arrive": "We have arrived! Well done!",
    "subway-mind-gap": "Mind the gap! Step down carefully!",
    "subway-place-zoo": "Let's go to the zoo!",
    "subway-place-lunapark": "Let's go to the theme park!",
    "subway-place-baseball": "Let's go to the baseball park!",
    "subway-place-palace": "Let's go to the palace!",
    "subway-place-namsan": "Let's go to Namsan Tower!",
    "subway-place-hanriver": "Let's go to the river park!",
    "subway-place-skypark": "Let's go to the sky park!",
    "subway-place-childpark": "Let's go to the children's park!",
    "subway-place-lake": "Let's go to the lake!",
    "subway-place-assembly": "Let's go to the assembly hall!",
    "subway-station-moran": "This stop is Moran.",
    "subway-station-gayang": "This stop is Gayang.",
    "subway-station-assembly": "This stop is the National Assembly.",
    "subway-station-bongeunsa": "This stop is Bongeunsa.",
}
KO_ONES = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"]
EN_ONES = [
    "", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve", "thirteen",
    "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
    "nineteen",
]
EN_TENS = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty",
    "seventy", "eighty", "ninety",
]


def korean_number(number):
    if number == 100:
        return "백!"
    if number > 100:
        return f"백{korean_number(number - 100)[:-1]}!"
    tens, ones = divmod(number, 10)
    if tens == 0:
        return f"{KO_ONES[ones]}!"
    prefix = "" if tens == 1 else KO_ONES[tens]
    return f"{prefix}십{KO_ONES[ones]}!"


def english_number(number):
    if number == 100:
        return "One hundred!"
    if number > 100:
        return f"One hundred and {english_number(number - 100)[:-1].lower()}!"
    if number < 20:
        return f"{EN_ONES[number].capitalize()}!"
    tens, ones = divmod(number, 10)
    phrase = (
        EN_TENS[tens]
        if ones == 0
        else f"{EN_TENS[tens]}-{EN_ONES[ones]}"
    )
    return f"{phrase.capitalize()}!"


KO_NUMBERS = {
    f"number-{number}": korean_number(number)
    for number in range(1, 151)
}
KO_CHEERS = {
    "cheer-1": "참 잘했어요!", "cheer-2": "대단해요!",
    "cheer-3": "정답이에요!", "cheer-4": "멋지게 해냈어요!",
}
KO_RETRIES = {
    "retry-1": "괜찮아, 다시 해 봐요.",
    "retry-2": "천천히 생각해 볼까요?",
    "retry-3": "블록을 같이 세어 봐요.",
}
KO_PAINT = {
    "paint-intro": "물감을 골라 섞어 봐요!",
    "paint-order-firetruck": "소방차를 빨강으로 칠해 볼까?",
    "paint-order-chick": "병아리를 노랑으로 칠해 볼까?",
    "paint-order-bus": "버스를 파랑으로 칠해 볼까?",
    "paint-order-carrot": "당근을 주황으로 칠해 볼까?",
    "paint-order-car": "자동차를 주황으로 칠해 볼까?",
    "paint-order-frog": "개구리를 초록으로 칠해 볼까?",
    "paint-order-tractor": "트랙터를 초록으로 칠해 볼까?",
    "paint-order-grape": "포도를 보라로 칠해 볼까?",
    "paint-order-heli": "헬리콥터를 보라로 칠해 볼까?",
    "paint-order-blossom": "벚꽃을 분홍으로 칠해 볼까?",
    "paint-order-boat": "돛단배를 하늘색으로 칠해 볼까?",
    "paint-order-bear": "곰돌이를 밤색으로 칠해 볼까?",
    "paint-order-rocket": "로켓을 남색으로 칠해 볼까?",
    "paint-order-strawberry": "딸기를 빨강으로 칠해 볼까?",
    "paint-order-banana": "바나나를 노랑으로 칠해 볼까?",
    "paint-order-whale": "고래를 파랑으로 칠해 볼까?",
    "paint-order-crow": "까마귀를 검정으로 칠해 볼까?",
    "paint-order-snowman": "눈사람을 하양으로 칠해 볼까?",
    "paint-order-tangerine": "귤을 주황으로 칠해 볼까?",
    "paint-order-plane": "비행기를 하늘색으로 칠해 볼까?",
    "paint-order-submarine": "잠수함을 남색으로 칠해 볼까?",
    "paint-order-pig": "돼지를 분홍으로 칠해 볼까?",
    "paint-order-peach": "복숭아를 살구색으로 칠해 볼까?",
    "paint-order-caterpillar": "애벌레를 연두로 칠해 볼까?",
    "paint-order-butterfly": "나비를 연보라로 칠해 볼까?",
    "paint-order-acorn": "도토리를 고동색으로 칠해 볼까?",
    "paint-order-pine": "소나무를 진초록으로 칠해 볼까?",
    "paint-order-eggplant": "가지를 진보라로 칠해 볼까?",
    "paint-order-sandcastle": "모래성을 모래색으로 칠해 볼까?",
    "paint-order-camel": "낙타를 모래색으로 칠해 볼까?",
    "paint-order-dumptruck": "덤프트럭을 황토색으로 칠해 볼까?",
    "paint-order-elephant": "코끼리를 회보라로 칠해 볼까?",
    "paint-order-cactus": "선인장을 쑥색으로 칠해 볼까?",
    "paint-mix-orange": "빨강과 노랑을 섞으면 주황!",
    "paint-mix-green": "노랑과 파랑을 섞으면 초록!",
    "paint-mix-purple": "빨강과 파랑을 섞으면 보라!",
    "paint-mix-pink": "빨강과 하양을 섞으면 분홍!",
    "paint-mix-sky": "파랑과 하양을 섞으면 하늘색!",
    "paint-mix-brown": "빨강과 검정을 섞으면 밤색!",
    "paint-mix-navy": "파랑과 검정을 섞으면 남색!",
    "paint-mix-lightyellow": "노랑과 하양을 섞으면 연노랑!",
    "paint-mix-olive": "노랑과 검정을 섞으면 올리브!",
    "paint-mix-gray": "검정과 하양을 섞으면 회색!",
    "paint-mix-peach": "빨강과 노랑과 하양을 섞으면 살구색!",
    "paint-mix-yellowgreen": "노랑과 파랑과 하양을 섞으면 연두!",
    "paint-mix-lavender": "빨강과 파랑과 하양을 섞으면 연보라!",
    "paint-mix-darkbrown": "빨강과 노랑과 파랑을 섞으면 고동색!",
    "paint-mix-darkgreen": "노랑과 파랑과 검정을 섞으면 진초록!",
    "paint-mix-darkpurple": "빨강과 파랑과 검정을 섞으면 진보라!",
    "paint-mix-brick": "빨강과 검정과 하양을 섞으면 벽돌색!",
    "paint-mix-khaki": "노랑과 검정과 하양을 섞으면 카키!",
    "paint-mix-bluegray": "파랑과 검정과 하양을 섞으면 청회색!",
    "paint-mix-sand": "빨강과 노랑과 파랑과 하양을 섞으면 모래색!",
    "paint-mix-ochre": "빨강과 노랑과 검정과 하양을 섞으면 황토색!",
    "paint-mix-grayviolet": "빨강과 파랑과 검정과 하양을 섞으면 회보라!",
    "paint-mix-sage": "노랑과 파랑과 검정과 하양을 섞으면 쑥색!",
    "paint-mix-mud": "빨강과 노랑과 파랑과 검정을 섞으면 먹색!",
    "paint-made-red": "우와, 빨강이 됐네!",
    "paint-made-yellow": "우와, 노랑이 됐네!",
    "paint-made-blue": "우와, 파랑이 됐네!",
    "paint-made-black": "우와, 검정이 됐네!",
    "paint-made-white": "우와, 하양이 됐네!",
    "paint-made-orange": "우와, 주황이 됐네!",
    "paint-made-green": "우와, 초록이 됐네!",
    "paint-made-purple": "우와, 보라가 됐네!",
    "paint-made-pink": "우와, 분홍이 됐네!",
    "paint-made-sky": "우와, 하늘색이 됐네!",
    "paint-made-brown": "우와, 밤색이 됐네!",
    "paint-made-navy": "우와, 남색이 됐네!",
    "paint-made-lightyellow": "우와, 연노랑이 됐네!",
    "paint-made-olive": "우와, 올리브가 됐네!",
    "paint-made-gray": "우와, 회색이 됐네!",
    "paint-made-peach": "우와, 살구색이 됐네!",
    "paint-made-yellowgreen": "우와, 연두가 됐네!",
    "paint-made-lavender": "우와, 연보라가 됐네!",
    "paint-made-darkbrown": "우와, 고동색이 됐네!",
    "paint-made-darkgreen": "우와, 진초록이 됐네!",
    "paint-made-darkpurple": "우와, 진보라가 됐네!",
    "paint-made-brick": "우와, 벽돌색이 됐네!",
    "paint-made-khaki": "우와, 카키가 됐네!",
    "paint-made-bluegray": "우와, 청회색이 됐네!",
    "paint-made-mud": "우와, 다 섞여서 먹색이 됐네!",
    "paint-unlock": "새 물감을 얻었어요! 이제 선반에서 바로 쓸 수 있어요!",
    "paint-made-sand": "우와, 모래색이 됐네!",
    "paint-made-ochre": "우와, 황토색이 됐네!",
    "paint-made-grayviolet": "우와, 회보라가 됐네!",
    "paint-made-sage": "우와, 쑥색이 됐네!",
    "paint-finale": "오늘의 그림을 다 그렸어요! 정말 멋진 화가예요!",
    "paint-rainbow": "우와, 무지개 화가 탄생! 일곱 가지 색을 다 모았어요!",
}
EN_PAINT = {
    "paint-intro": "Pick some paints and mix them!",
    "paint-order-firetruck": "Let's paint the fire truck red!",
    "paint-order-chick": "Let's paint the chick yellow!",
    "paint-order-bus": "Let's paint the bus blue!",
    "paint-order-carrot": "Let's paint the carrot orange!",
    "paint-order-car": "Let's paint the car orange!",
    "paint-order-frog": "Let's paint the frog green!",
    "paint-order-tractor": "Let's paint the tractor green!",
    "paint-order-grape": "Let's paint the grapes purple!",
    "paint-order-heli": "Let's paint the helicopter purple!",
    "paint-order-blossom": "Let's paint the blossom pink!",
    "paint-order-boat": "Let's paint the sailboat sky blue!",
    "paint-order-bear": "Let's paint the bear brown!",
    "paint-order-rocket": "Let's paint the rocket navy blue!",
    "paint-order-strawberry": "Let's paint the strawberry red!",
    "paint-order-banana": "Let's paint the banana yellow!",
    "paint-order-whale": "Let's paint the whale blue!",
    "paint-order-crow": "Let's paint the crow black!",
    "paint-order-snowman": "Let's paint the snowman white!",
    "paint-order-tangerine": "Let's paint the tangerine orange!",
    "paint-order-plane": "Let's paint the airplane sky blue!",
    "paint-order-submarine": "Let's paint the submarine navy blue!",
    "paint-order-pig": "Let's paint the pig pink!",
    "paint-order-peach": "Let's paint the peach a soft peach colour!",
    "paint-order-caterpillar": "Let's paint the caterpillar light green!",
    "paint-order-butterfly": "Let's paint the butterfly light purple!",
    "paint-order-acorn": "Let's paint the acorn dark brown!",
    "paint-order-pine": "Let's paint the pine tree dark green!",
    "paint-order-eggplant": "Let's paint the eggplant dark purple!",
    "paint-order-sandcastle": "Let's paint the sandcastle sandy beige!",
    "paint-order-camel": "Let's paint the camel sandy beige!",
    "paint-order-dumptruck": "Let's paint the dump truck ochre yellow!",
    "paint-order-elephant": "Let's paint the elephant grey purple!",
    "paint-order-cactus": "Let's paint the cactus sage green!",
    "paint-mix-orange": "Red and yellow make orange!",
    "paint-mix-green": "Yellow and blue make green!",
    "paint-mix-purple": "Red and blue make purple!",
    "paint-mix-pink": "Red and white make pink!",
    "paint-mix-sky": "Blue and white make sky blue!",
    "paint-mix-brown": "Red and black make brown!",
    "paint-mix-navy": "Blue and black make navy!",
    "paint-mix-lightyellow": "Yellow and white make light yellow!",
    "paint-mix-olive": "Yellow and black make olive!",
    "paint-mix-gray": "Black and white make grey!",
    "paint-mix-peach": "Red, yellow and white make peach!",
    "paint-mix-yellowgreen": "Yellow, blue and white make light green!",
    "paint-mix-lavender": "Red, blue and white make light purple!",
    "paint-mix-darkbrown": "Red, yellow and blue make dark brown!",
    "paint-mix-darkgreen": "Yellow, blue and black make dark green!",
    "paint-mix-darkpurple": "Red, blue and black make dark purple!",
    "paint-mix-brick": "Red, black and white make brick red!",
    "paint-mix-khaki": "Yellow, black and white make khaki!",
    "paint-mix-bluegray": "Blue, black and white make blue grey!",
    "paint-mix-sand": "Red, yellow, blue and white make sandy beige!",
    "paint-mix-ochre": "Red, yellow, black and white make ochre yellow!",
    "paint-mix-grayviolet": "Red, blue, black and white make grey purple!",
    "paint-mix-sage": "Yellow, blue, black and white make sage green!",
    "paint-mix-mud": "Red, yellow, blue and black make inky black!",
    "paint-made-red": "Wow, you made red!",
    "paint-made-yellow": "Wow, you made yellow!",
    "paint-made-blue": "Wow, you made blue!",
    "paint-made-black": "Wow, you made black!",
    "paint-made-white": "Wow, you made white!",
    "paint-made-orange": "Wow, you made orange!",
    "paint-made-green": "Wow, you made green!",
    "paint-made-purple": "Wow, you made purple!",
    "paint-made-pink": "Wow, you made pink!",
    "paint-made-sky": "Wow, you made sky blue!",
    "paint-made-brown": "Wow, you made brown!",
    "paint-made-navy": "Wow, you made navy!",
    "paint-made-lightyellow": "Wow, you made light yellow!",
    "paint-made-olive": "Wow, you made olive!",
    "paint-made-gray": "Wow, you made grey!",
    "paint-made-peach": "Wow, you made peach!",
    "paint-made-yellowgreen": "Wow, you made light green!",
    "paint-made-lavender": "Wow, you made light purple!",
    "paint-made-darkbrown": "Wow, you made dark brown!",
    "paint-made-darkgreen": "Wow, you made dark green!",
    "paint-made-darkpurple": "Wow, you made dark purple!",
    "paint-made-brick": "Wow, you made brick red!",
    "paint-made-khaki": "Wow, you made khaki!",
    "paint-made-bluegray": "Wow, you made blue grey!",
    "paint-made-mud": "Wow, they all mixed into inky black!",
    "paint-unlock": "You earned a new paint! Now it's on your shelf!",
    "paint-made-sand": "Wow, you made sandy beige!",
    "paint-made-ochre": "Wow, you made ochre yellow!",
    "paint-made-grayviolet": "Wow, you made grey purple!",
    "paint-made-sage": "Wow, you made sage green!",
    "paint-finale": "You finished all the paintings! What a wonderful artist!",
    "paint-rainbow": "Wow, a rainbow artist! You collected all seven colours!",
}

EN = {
    f"number-{number}": english_number(number)
    for number in range(1, 151)
}


KO_DELIVERY = {
    "delivery-intro": "택배가 왔어요! 목표 호수로 배달해요.",
    "delivery-go": "출발!",
    "delivery-blocked": "그쪽은 길이 아니에요. 다시 만들어 봐요.",
    "delivery-wrong-house": "여기가 아니에요. 목표 호수를 다시 봐요.",
    "delivery-arrive": "도착했어요! 이제 엘리베이터를 타요.",
    "delivery-floor-wrong": "그 층이 아니에요. 목표 층을 눌러요.",
    "delivery-floor-ok": "다 왔어요! 문이 열려요.",
    "delivery-door-wrong": "이 문이 아니에요. 라벨과 같은 호수를 찾아요.",
    "delivery-bell": "딩동! 택배 왔어요.",
    "delivery-parcel-wrong": "친구가 기다리는 물건이 아니에요. 다시 골라요.",
    "delivery-parcel-ok": "고마워요! 잘 전달했어요.",
    "delivery-finale": "오늘 배달을 모두 마쳤어요. 정말 잘했어요!",
    "delivery-parcel-fruit": "과일 상자",
    "delivery-parcel-cosmetic": "화장품 상자",
    "delivery-parcel-toy": "장난감 상자",
}

EN_DELIVERY = {
    "delivery-intro": "A parcel is here! Drive it to the right home.",
    "delivery-go": "Let's go!",
    "delivery-blocked": "That way is blocked. Try another path.",
    "delivery-wrong-house": "This is not the one. Check the number again.",
    "delivery-arrive": "We are here! Now take the elevator.",
    "delivery-floor-wrong": "That is not the floor. Press the goal floor.",
    "delivery-floor-ok": "Here we are! The doors are opening.",
    "delivery-door-wrong": "Not this door. Find the same number as the label.",
    "delivery-bell": "Ding dong! Delivery!",
    "delivery-parcel-wrong": "That is not what your friend wants. Try again.",
    "delivery-parcel-ok": "Thank you! Well delivered.",
    "delivery-finale": "All parcels delivered. Great job today!",
    "delivery-parcel-fruit": "fruit box",
    "delivery-parcel-cosmetic": "lotion box",
    "delivery-parcel-toy": "toy box",
}

async def render_pack(lang, lines, voice, rate, pitch):
    output = ROOT / lang
    output.mkdir(parents=True, exist_ok=True)
    for name, text in lines.items():
        target = output / f"{name}.mp3"
        if target.exists() and target.stat().st_size > 1024:
            print(f"skip {target.relative_to(ROOT.parent)}")
            continue
        communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        await communicate.save(str(target))
        print(target.relative_to(ROOT.parent))


async def main():
    # Mild adjustments keep the neural Korean voice natural rather than caricatured:
    # prompts are calm, number answers have a bright lift, praise is warm, and retries
    # slow down slightly so they remain encouraging.
    await render_pack("ko", KO_PROMPTS, KO_VOICE, "-4%", "+0Hz")
    await render_pack("ko", KO_NUMBERS, KO_VOICE, "+5%", "+7Hz")
    await render_pack("ko", KO_CHEERS, KO_VOICE, "+3%", "+4Hz")
    await render_pack("ko", KO_RETRIES, KO_VOICE, "-8%", "-2Hz")
    await render_pack("ko", KO_SAFETY, KO_VOICE, "-5%", "+2Hz")
    await render_pack("ko", KO_SRT, KO_VOICE, "-5%", "+2Hz")
    await render_pack("ko", KO_SUBWAY, KO_VOICE, "-5%", "+2Hz")
    await render_pack("ko", KO_PAINT, KO_VOICE, "-4%", "+3Hz")
    await render_pack("ko", KO_DELIVERY, KO_VOICE, "-4%", "+3Hz")
    await render_pack("en", EN_PROMPTS, EN_VOICE, "-4%", "+0Hz")
    await render_pack("en", EN_SAFETY, EN_VOICE, "-5%", "+2Hz")
    await render_pack("en", EN_SRT, EN_VOICE, "-5%", "+2Hz")
    await render_pack("en", EN_SUBWAY, EN_VOICE, "-5%", "+2Hz")
    await render_pack("en", EN_PAINT, EN_VOICE, "-4%", "+3Hz")
    await render_pack("en", EN_DELIVERY, EN_VOICE, "-4%", "+3Hz")
    await render_pack("en", EN, EN_VOICE, "+4%", "+7Hz")


if __name__ == "__main__":
    asyncio.run(main())
